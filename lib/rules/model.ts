/**
 * Asking a model to read one programme's requirement sentence.
 *
 * This is the only file in the codebase that talks to an LLM, and it is kept to
 * as little as possible: build a prompt, make one call, hand the reply to
 * `parseRuleResponse` and let that decide whether it is usable. The decisions
 * worth testing live in `lib/rules/reader.ts`; what is left here is the part
 * that cannot be tested without a network.
 *
 * GROQ, AND RAW HTTP RATHER THAN AN SDK. This project carries no LLM SDK and
 * does not need one: this is one POST to an OpenAI-shaped endpoint with a static
 * body, so the whole of what an SDK would do here is `fetch`, `JSON.stringify`
 * and `JSON.parse`. The missing-package failure mode is also unusually nasty —
 * `lib/db/rules.ts` is imported by `lib/db/queries.ts`, so an unresolved import
 * here takes down every page that reads the catalogue, not just this feature.
 *
 * Groq specifically because its free tier is permanent and needs no card, and
 * because it is the fastest of the free providers — a student is waiting on this
 * call in the UI, so latency is a product decision and not just a cost one.
 * The architecture makes the quota a non-issue: a rule is read once per
 * programme and stored forever, so total calls are bounded by how many distinct
 * courses students actually pick, not by how many students pick them.
 *
 * SERVER ONLY. The key is read from the process environment at request time and
 * is deliberately NOT prefixed `NEXT_PUBLIC_` — there is no `NEXT_PUBLIC_`
 * variable anywhere in this repository and this must not be the first. Nothing
 * here may be imported from a client component.
 *
 * THE KEY IS OPTIONAL BY DESIGN. With no key set, `hasRuleReader()` is false and
 * every caller falls back to exactly today's behaviour: the catalogue still
 * lists the programme, the panel still says we have not reviewed it, and no
 * request is made. A missing key degrades the feature; it does not break the app.
 */

import {
  buildRulePrompt,
  parseRuleResponse,
  ruleFailure,
  type RuleFailure,
  type RuleOutcome,
} from '@/lib/rules/reader'
import { SUBJECT_CODES } from '@/lib/types'

/**
 * Reading one short sentence into a fixed shape is extraction, not reasoning,
 * and the result is stored forever — so a small, fast, cheap model is right.
 *
 * One of the three models Groq serves with *strict* JSON-schema output
 * (`gpt-oss-20b`, `gpt-oss-120b`, `qwen/qwen3.8-27b`). The 120b is chosen over
 * the 20b because a wrong reading becomes a wrong eligibility verdict shown to a
 * student, and this call happens once per programme for the whole country — the
 * quality is worth more than the milliseconds here.
 */
export const RULE_MODEL = 'openai/gpt-oss-120b'

const API_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Ceiling on the reply. A rule is a handful of fields, so this is generous.
 *
 * `max_completion_tokens`, not `max_tokens`: Groq documents the latter as
 * deprecated. It doubles as a guard on the per-minute token budget, which is the
 * limit most likely to bind before the daily request count does.
 */
const MAX_COMPLETION_TOKENS = 1024

/**
 * How hard the model thinks before answering.
 *
 * `low` on purpose. The task is lifting four fields out of one sentence that
 * states them outright — there is nothing to reason about, and reasoning here
 * would spend latency the student is sitting in front of and tokens against the
 * free tier's per-minute budget. Raise this if readings start coming back wrong,
 * not pre-emptively: a reading nobody could check is a cost with no visible
 * benefit.
 */
const REASONING_EFFORT = 'low'

/**
 * How long a student waits before we give up.
 *
 * There has to be a ceiling: without one a stalled connection holds the panel
 * open indefinitely, and a student who has already been told the read is coming
 * never gets told it failed. This is a long wait for a UI, but the honest
 * alternative to waiting is the "we have not reviewed this" panel, which is
 * exactly what arrives when this fires.
 */
const TIMEOUT_MS = 30_000

/** Attempts per read, including the first. See `askModelForRule`. */
const MAX_ATTEMPTS = 2

/** How long a retry waits when the provider did not say. */
const RETRY_WAIT_MS = 1_500

/**
 * The longest we will honour a `retry-after`.
 *
 * A per-minute ceiling can report a wait longer than a student will stand in
 * front of the picker, and the honest answer past that point is today's panel,
 * not a spinner.
 */
const MAX_RETRY_WAIT_MS = 5_000

/**
 * The shape the reply must take, as JSON Schema.
 *
 * This is the first of two gates, and it is enforced by the provider rather than
 * by us — in strict mode a reply that does not match is not returned at all. It
 * pins only the *shape*. The real checks — that the subject codes exist, that
 * `mandatory` does not exceed `minCredits`, that no "choose two from" group is
 * unsatisfiable — are cross-field conditions JSON Schema cannot express, and they
 * run in `parseRuleResponse` afterwards. Two gates on purpose: this one gets
 * well-formed JSON, that one decides whether the JSON is true.
 *
 * Strict mode's rules, which this schema obeys: every property must appear in
 * `required` (a genuinely optional value is a union with `null`), and every
 * object must set `additionalProperties: false`. Note also what is *not* here —
 * `minimum`/`maximum` are not in the supported subset, so those live in the
 * validator instead.
 */
const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    confidence: {
      type: 'string',
      enum: ['high', 'low'],
      description:
        'high only if the sentence is unambiguous; low if you had to interpret it or fill a gap',
    },
    outcome: {
      type: 'string',
      enum: ['rule', 'none', 'unreadable'],
      description:
        '"rule" if a requirement was read; "none" only if the sentence states no requirement at all; "unreadable" if it states one you cannot return faithfully',
    },
    rule: {
      description: 'null for both "none" and "unreadable"; an object only for "rule"',
      anyOf: [
        {
          type: 'object',
          properties: {
            minCredits: {
              type: 'integer',
              description: 'How many credit passes the course requires in total',
            },
            mandatory: {
              type: 'array',
              items: { type: 'string', enum: [...SUBJECT_CODES] },
              description: 'Subjects that must be credited',
            },
            anyOf: {
              type: 'array',
              description:
                'Groups of the form "any two of X, Y, Z". Empty when the sentence names none.',
              items: {
                type: 'object',
                properties: {
                  subjects: {
                    type: 'array',
                    items: { type: 'string', enum: [...SUBJECT_CODES] },
                    description: 'The subjects to choose from',
                  },
                  count: { type: 'integer', description: 'How many of them are needed' },
                  label: {
                    type: 'string',
                    description: 'Short human label, e.g. "science subjects"',
                  },
                },
                required: ['subjects', 'count', 'label'],
                additionalProperties: false,
              },
            },
            maxSittings: {
              type: 'integer',
              description: 'Sittings the results may be combined across. 2 unless stated.',
            },
            unmapped: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Subjects the sentence names that have no code, and that were dropped from a group because of it. Empty when every subject has a code.',
            },
          },
          required: ['minCredits', 'mandatory', 'anyOf', 'maxSittings', 'unmapped'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
  },
  required: ['confidence', 'outcome', 'rule'],
  additionalProperties: false,
} as const

/**
 * Whether this deployment can read rules at all.
 *
 * Mirrors `hasSwiftCredentials` in `lib/swift/config.ts`. The `your_` guard is
 * there because `.env.local` documents the variable with a placeholder rather
 * than leaving it blank, and a placeholder must read as "not configured" rather
 * than as a key that fails on every request.
 */
export function hasRuleReader(): boolean {
  const apiKey = process.env.GROQ_API_KEY
  return Boolean(apiKey && !apiKey.startsWith('your_'))
}

/**
 * The reply body, read into a rule or refused with a reason.
 *
 * Everything about this response is `unknown` until it is checked. It arrives
 * from outside the program, and a proxy, an error page or a provider change must
 * all read as "no reading" rather than as a crash in the middle of a student's
 * eligibility check.
 */
function readReply(body: unknown): RuleOutcome {
  const choices = (body as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices.length) {
    return ruleFailure('empty-reply', 'the response carried no choices')
  }

  const choice = choices[0] as { message?: unknown; finish_reason?: unknown } | undefined

  // Named rather than left to the JSON parse below, because a truncated reply
  // and a model that produced nonsense look identical once the parse throws —
  // and they have opposite fixes. This one means `MAX_COMPLETION_TOKENS` is too
  // low, which is our bug, not the model's.
  if (choice?.finish_reason === 'length') {
    return ruleFailure('truncated', `hit the ${MAX_COMPLETION_TOKENS}-token ceiling`)
  }

  const content = (choice?.message as { content?: unknown } | undefined)?.content
  if (typeof content !== 'string' || !content.trim()) {
    return ruleFailure('empty-reply', 'the reply carried no text')
  }

  try {
    return parseRuleResponse(JSON.parse(content))
  } catch {
    // Strict mode means this should not happen; if it does, the first of the
    // body is the only thing that makes it diagnosable.
    return ruleFailure('bad-json', content.slice(0, 160))
  }
}

/** One POST, and whether it came back with a body. */
type Attempt = { ok: true; body: unknown } | { ok: false; failure: RuleFailure; retryAfterMs: number }

/** Whether asking the same question again could produce a different answer. */
function isRetryable(failure: RuleFailure): boolean {
  if (failure.reason === 'rate-limited' || failure.reason === 'network') return true
  // A 5xx is the provider failing to answer; a 4xx is the provider answering,
  // and it will answer the same way next time.
  return failure.reason === 'http-error' && (failure.detail ?? '').startsWith('5')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postOnce(apiKey: string, input: {
  programme: string
  institution: string
  sourceText: string
}): Promise<Attempt> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: RULE_MODEL,
        messages: [{ role: 'user', content: buildRulePrompt(input) }],
        // Extraction, not composition: the same sentence should produce the same
        // rule every time, and the row is stored permanently.
        temperature: 0,
        reasoning_effort: REASONING_EFFORT,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'programme_rule', strict: true, schema: REPLY_SCHEMA },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      const detail = `${response.status} ${(await response.text()).slice(0, 200)}`

      // The status is what decides the remedy, so it is carried out rather than
      // flattened into "it failed". A 429 in particular is ordinary on the free
      // tier and is the one failure that a warm-up run will produce in bulk —
      // which is exactly the run whose report has to name it.
      return {
        ok: false,
        failure: ruleFailure(response.status === 429 ? 'rate-limited' : 'http-error', detail),
        retryAfterMs: retryAfterMs(response.headers.get('retry-after')),
      }
    }

    return { ok: true, body: await response.json() }
  } catch (error) {
    // `AbortSignal.timeout` rejects with a TimeoutError, which is a different
    // problem from a socket that never opened and is worth telling apart: the
    // first means the model is slow, the second means we never reached it.
    const name = (error as { name?: unknown }).name
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, failure: ruleFailure('timeout', `no reply within ${TIMEOUT_MS}ms`), retryAfterMs: 0 }
    }

    return {
      ok: false,
      failure: ruleFailure('network', error instanceof Error ? error.message : String(error)),
      retryAfterMs: 0,
    }
  }
}

/** The wait the provider asked for, bounded so a hostile header cannot stall a request. */
function retryAfterMs(header: string | null): number {
  const seconds = Number(header)
  if (!Number.isFinite(seconds) || seconds <= 0) return RETRY_WAIT_MS
  return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS)
}

/**
 * Read one programme's requirement, or say why it could not be read.
 *
 * Returning a reason rather than throwing is the whole error policy: a failure
 * here means "we could not read this", which every caller already knows how to
 * render, and it must not be confused with `'no-source'` — that is a successful
 * read of a sentence that states nothing, and it is remembered permanently.
 *
 * A failed read is never stored, so a rate-limited or unreachable provider costs
 * the student who hit it their verdict for this sitting and nothing more: the
 * next request tries again.
 *
 * ONE RETRY, AND ONLY WHERE IT CAN HELP. A warm-up run over a whole school is
 * precisely the traffic that trips the free tier's per-minute ceiling, and the
 * ceiling clears on its own within seconds — so a 429 that is not retried turns
 * a course that would have read fine into a course that reads as broken. The
 * retry is bounded to one attempt and the wait is capped, because the
 * alternative to waiting is the "we have not reviewed this" panel, which is
 * what arrives anyway. Everything else is returned as it came: a schema we
 * rejected or a sentence the model could not read produces the same reply a
 * second time, and paying for it twice is the waste this whole file exists to
 * avoid.
 */
export async function askModelForRule(input: {
  programme: string
  institution: string
  sourceText: string
}): Promise<RuleOutcome> {
  const apiKey = process.env.GROQ_API_KEY
  if (!hasRuleReader() || !apiKey) {
    return ruleFailure('no-key', 'GROQ_API_KEY is not configured')
  }

  for (let attempt = 0; ; attempt += 1) {
    const result = await postOnce(apiKey, input)
    if (result.ok) return readReply(result.body)

    if (attempt >= MAX_ATTEMPTS - 1 || !isRetryable(result.failure)) return result.failure

    await sleep(result.retryAfterMs)
  }
}
