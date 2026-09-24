/**
 * Turning a brochure sentence into the structured rule the engine counts.
 *
 * WHY THIS EXISTS: IBASS publishes requirements as prose. "Five (5) SSC credit
 * passes in English Language, Mathematics, Biology and any two (2) of Chemistry,
 * Physics, Agricultural Science" is a perfectly clear sentence to a human and
 * completely unusable to `checkEligibility`, which needs
 * `{ minCredits: 5, mandatory: ['ENG','MTH','BIO'], anyOf: [...] }`. This module
 * is the conversion, and it is the only place in the codebase where a rule can
 * come from somewhere other than a person typing it into `courses.data.ts`.
 *
 * PURE AND MODEL-FREE ON PURPOSE. Everything here is a plain function of its
 * arguments: no network, no database, no API client. The model call lives in
 * `lib/rules/model.ts` and hands its raw output to `parseRuleResponse` below.
 * That split is what lets the interesting half — deciding whether a sentence was
 * read correctly — be tested exhaustively without a key, a network, or a bill.
 *
 * THE GOVERNING PRINCIPLE IS REJECTION, NOT REPAIR. A rule is a claim that we
 * know what a course requires. `parseRuleResponse` therefore refuses anything it
 * cannot fully account for rather than patching a half-read sentence into shape,
 * because a wrong rule produces a confident wrong verdict and a missing rule
 * produces an honest "we haven't reviewed this".
 */

import { createHash } from 'node:crypto'

import { z } from 'zod'

import {
  SUBJECT_CODES,
  subjectName,
  type AnyOfGroup,
  type OLevelRule,
  type RuleConfidence,
  type SubjectCode,
} from '@/lib/types'

/* -------------------------------------------------------------------------- */
/* Reading the brochure's HTML                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Entities the brochure actually uses. Not an exhaustive HTML table — a name we
 * do not know is left as written rather than guessed at, so nothing is silently
 * turned into the wrong character.
 */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
}

/**
 * Block-level tags, which mark a break between two thoughts.
 *
 * A space is not cosmetic here. The brochure writes a requirement as a series of
 * `<p>` blocks, and stripping the tags without leaving anything behind glues the
 * end of one sentence to the start of the next — "...and any two (2) of" runs
 * straight into "1. Economics" as though the subject were called
 * "of1. Economics".
 */
const BLOCK_TAGS = /<\/?(?:p|div|li|tr|td|table|tbody|br|h[1-6])\b[^>]*>/gi

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1]?.toLowerCase() === 'x'
      const code = hex ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1))
      // Surrogate halves and out-of-range points would throw in fromCodePoint,
      // so an unreadable escape stays as it was written.
      if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return match
      return String.fromCodePoint(code)
    }
    return ENTITIES[body.toLowerCase()] ?? match
  })
}

/**
 * The requirement a programme states, as one line of plain text.
 *
 * Order matters: tags are stripped before entities are decoded, so a literal
 * `&lt;p&gt;` inside a sentence survives as text instead of being read as markup
 * on the second pass.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, ' ')
      .replace(BLOCK_TAGS, ' ')
      // Everything else is markup with no textual content — including the
      // `<o:p>` tags Word leaves throughout the brochure, which are never closed.
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A stable digest of the text a rule was read from.
 *
 * Taken over the *extracted text* rather than the raw HTML, deliberately. Word
 * re-exports the brochure with different styling from time to time, and a hash
 * over the markup would report every rule as stale when not a word of the
 * requirement had changed.
 */
export function sourceHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32)
}

/* -------------------------------------------------------------------------- */
/* Validating what the model said                                              */
/* -------------------------------------------------------------------------- */

const subjectSchema = z.enum(SUBJECT_CODES as [SubjectCode, ...SubjectCode[]])

const anyOfSchema = z.object({
  subjects: z.array(subjectSchema).min(1).max(12),
  count: z.number().int().min(1).max(9),
  label: z.string().trim().min(1).max(60),
})

/**
 * The shape a rule must have to be stored. Every bound here is a way a
 * plausible-looking but wrong reading gets caught before it can produce a
 * verdict.
 */
const ruleSchema = z
  .object({
    // Nine is the most subjects a student can enter; a course asking for more
    // than that could never be satisfied by anyone.
    minCredits: z.number().int().min(1).max(9),
    mandatory: z.array(subjectSchema).min(1).max(9),
    anyOf: z.array(anyOfSchema).max(4).optional(),
    // The engine accepts results from two sittings; the brochure rarely says, so
    // silence means the normal rule rather than no rule.
    maxSittings: z.number().int().min(1).max(2).default(2),
    unmapped: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  })
  .superRefine((rule, ctx) => {
    const fail = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path })

    // Asking for more mandatory subjects than credits means the sentence was
    // read as requiring two different numbers of things at once.
    if (rule.mandatory.length > rule.minCredits) {
      fail('asks for more mandatory subjects than credits', ['mandatory'])
    }
    if (new Set(rule.mandatory).size !== rule.mandatory.length) {
      fail('lists the same mandatory subject twice', ['mandatory'])
    }

    const mandatory = new Set<string>(rule.mandatory)

    for (const [index, group] of (rule.anyOf ?? []).entries()) {
      // The engine counts a group only over the subjects that are *not* already
      // mandatory — a course asking for "Physics plus any two sciences" must not
      // have Physics satisfy both halves of its own requirement. A group made
      // entirely of mandatory subjects therefore has nothing left to count and
      // could never be met by anyone, which means it was misread.
      const eligible = group.subjects.filter((subject) => !mandatory.has(subject))
      if (!eligible.length) {
        fail('every subject in this group is already mandatory', ['anyOf', index])
      }
      if (group.count > eligible.length) {
        fail('asks for more subjects than the group offers', ['anyOf', index])
      }
    }
  })

/**
 * What reading one programme produced.
 *
 * `'no-source'` is a real answer, not a failure: it means there is nothing to
 * read here and there never will be, so the programme should not be asked about
 * again.
 */
export type RuleRead =
  | { status: 'ready'; rule: OLevelRule; confidence: RuleConfidence }
  | { status: 'no-source'; rule: null; confidence: RuleConfidence }

/**
 * Why a read produced no rule.
 *
 * A failed read is never stored, which is right — but it also means that
 * without a reason the only thing anyone can say about a programme that will
 * not read is that it will not read. Every one of these is fixed differently,
 * and two of them are not bugs at all:
 *
 *   `no-key`, `timeout`, `network`, `http-error`   — the call did not land
 *   `rate-limited`                                 — the provider's ceiling
 *   `truncated`, `empty-reply`, `bad-json`         — the reply came back wrong
 *   `malformed-reply`, `schema-rejected`           — the reply was not true
 *   `model-unreadable`, `model-uncertain`          — the sentence, or the model
 *   `rule-missing`                                 — the reply contradicts itself
 */
export type RuleFailureReason =
  | 'no-key'
  | 'no-database'
  | 'timeout'
  | 'network'
  | 'http-error'
  | 'rate-limited'
  | 'truncated'
  | 'empty-reply'
  | 'bad-json'
  | 'malformed-reply'
  | 'model-unreadable'
  | 'model-uncertain'
  | 'rule-missing'
  | 'schema-rejected'
  | 'no-programme'

/** A read that produced nothing, and enough to say why. */
export type RuleFailure = {
  status: 'failed'
  reason: RuleFailureReason
  /** Whatever the reason alone does not say — an HTTP status, a schema issue. */
  detail?: string
}

/**
 * What one attempt at reading a programme produced.
 *
 * The failure arm exists so that "it did not work" arrives with a reason
 * attached, rather than as the bare `null` that made every broken read look
 * identical to every unreadable sentence.
 */
export type RuleOutcome = RuleRead | RuleFailure

/**
 * What the model says it did. The reply has to carry this explicitly.
 *
 * It used to be inferred from `rule === null`, and that was a real bug rather
 * than a stylistic one: `null` was the only way the model could say *either*
 * "this sentence states no requirement" *or* "I could not read this sentence",
 * and those two have opposite remedies. The first is a fact worth remembering
 * forever; the second is a failure worth retrying and must never be remembered
 * at all. Collapsing them meant a sentence the model merely found awkward — the
 * first live read, where two of seven group subjects had no code — was written
 * to the database as a permanent "nothing to read here", and the course could
 * never be asked about again.
 */
const OUTCOMES = ['rule', 'none', 'unreadable'] as const
type Outcome = (typeof OUTCOMES)[number]

function isOutcome(value: unknown): value is Outcome {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value)
}

function isConfidence(value: unknown): value is RuleConfidence {
  return value === 'high' || value === 'low'
}

/**
 * A failed read, spelled once so every producer of one looks the same.
 *
 * Exported because `lib/rules/model.ts` produces failures too — a call that
 * never landed is as much a reason as a reply that was refused, and both end up
 * in the same report.
 */
export function ruleFailure(reason: RuleFailureReason, detail?: string): RuleFailure {
  return { status: 'failed', reason, ...(detail ? { detail } : {}) }
}

/**
 * Validate the model's reply into a rule, or refuse it with a reason.
 *
 * Every refusal here means "the read failed", and a failed read is never
 * stored — so the programme stays open and the next request tries again. What
 * changed is that the refusal now says *which* refusal it was. That matters
 * because the remedies are opposite: a schema rejection is our prompt or our
 * validator and is ours to fix, `model-unreadable` is the brochure's sentence
 * and is not, and `model-uncertain` is a guess we declined to write down.
 */
export function parseRuleResponse(value: unknown): RuleOutcome {
  if (!value || typeof value !== 'object') {
    return ruleFailure('malformed-reply', `reply was ${value === null ? 'null' : typeof value}`)
  }

  const { confidence, outcome, rule } = value as {
    confidence?: unknown
    outcome?: unknown
    rule?: unknown
  }
  if (!isConfidence(confidence) || !isOutcome(outcome)) {
    return ruleFailure(
      'malformed-reply',
      `confidence=${JSON.stringify(confidence)} outcome=${JSON.stringify(outcome)}`,
    )
  }

  if (outcome === 'unreadable') {
    return ruleFailure('model-unreadable', 'the model could not return the sentence faithfully')
  }

  if (outcome === 'none') {
    // "Nothing to read here" is only recorded when the model is sure. A *low*
    // confidence "none" is a guess, and a guess written down becomes a course
    // that is never offered a check again — so it is treated as a failed read
    // and retried instead. Note how much this matters: only 6958 of the 21096
    // programmes in the mirror have no requirement text at all, so the honest
    // "there is nothing here" case is mostly caught before any model is called.
    if (rule !== null && rule !== undefined) {
      return ruleFailure('model-uncertain', 'reported no requirement and returned one anyway')
    }
    if (confidence !== 'high') {
      return ruleFailure('model-uncertain', 'reported no requirement, but at low confidence')
    }
    return { status: 'no-source', rule: null, confidence }
  }

  // outcome === 'rule'
  if (rule === null || rule === undefined) {
    return ruleFailure('rule-missing', 'reported a requirement and returned none')
  }

  const parsed = ruleSchema.safeParse(rule)
  if (!parsed.success) {
    // The issue text is the whole value of this branch: it names the field and
    // the bound that was broken, which is the difference between "the model is
    // wrong" and "our validator is".
    return ruleFailure(
      'schema-rejected',
      parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; '),
    )
  }

  const { minCredits, mandatory, anyOf, maxSittings } = parsed.data

  // Deduplicated once here so every consumer can rely on the lists being sets,
  // and so the engine's "is this subject already mandatory?" check cannot be
  // confused by a repeat.
  const groups: AnyOfGroup[] = (anyOf ?? []).map((group) => ({
    subjects: [...new Set(group.subjects)],
    count: group.count,
    label: group.label,
  }))

  const unmapped = [...new Set((parsed.data.unmapped ?? []).map((name) => name.trim()))]

  return {
    // A reading that had to leave something out cannot be a certain one. The
    // prompt asks for `low` in this case; forcing it here means the row is
    // findable later even if the model reports otherwise, which is the only
    // reason `confidence` is stored at all.
    confidence: unmapped.length ? 'low' : confidence,
    status: 'ready',
    rule: {
      minCredits,
      mandatory: [...new Set(mandatory)],
      ...(groups.length ? { anyOf: groups } : {}),
      maxSittings,
      ...(unmapped.length ? { unmapped } : {}),
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Asking the model                                                            */
/* -------------------------------------------------------------------------- */

const SUBJECT_LIST = SUBJECT_CODES.map((code) => `${code} = ${subjectName(code)}`).join('\n')

/**
 * The instruction sent with one programme's requirement sentence.
 *
 * Built as a plain string rather than a template of mixed parts so that the
 * exact text is snapshot-testable — the prompt is the part of this feature most
 * likely to be changed carelessly, and the only way to see the effect of a
 * change is to be able to read it.
 */
export function buildRulePrompt(input: {
  programme: string
  institution: string
  sourceText: string
}): string {
  return [
    'You are reading the O\'level entry requirement for one Nigerian university',
    'course and returning it as structured data. You will be given the exact',
    'sentence the JAMB IBASS brochure publishes for that course.',
    '',
    'Return the requirement as a rule with these fields:',
    '',
    '- minCredits: how many credit passes the course requires in total.',
    '- mandatory: the subjects that must be credited, as codes from the list below.',
    '- anyOf: groups of the form "any two of X, Y, Z". One entry per group, each',
    '  with the subjects to choose from, how many are needed, and a short label.',
    '- maxSittings: how many sittings the results may be combined across. Use 2',
    '  unless the sentence says otherwise.',
    '- unmapped: subjects the sentence names that have no code in the list below.',
    '  Empty array when every subject in the sentence has a code.',
    '',
    'Subject codes:',
    SUBJECT_LIST,
    '',
    'Rules you must follow:',
    '- Only A1 to C6 is a credit. "Credit pass", "SSC credit" and "credit" all',
    '  mean the same thing.',
    '- Do not put a subject in `mandatory` and also in an `anyOf` group.',
    '',
    'Subjects with no code are common in this brochure — "Business Management",',
    '"Data Processing/Computer Studies", "Basic Electricity", "Typewriting".',
    'What to do with one depends on where it appears, and the two cases are not',
    'the same:',
    '',
    '- One the sentence requires in its own right ("credit in English,',
    '  Mathematics and Business Management") cannot be dropped without making the',
    '  requirement weaker than it really is. Return "unreadable".',
    '- One that is a *choice* among several ("any two of Geography, Business',
    '  Management, Biology") can be dropped: the group is then narrower than the',
    '  brochure, never wider. Return the rule, leave that choice out of the group,',
    '  and list its name in `unmapped`.',
    '',
    '`outcome` says which of three things you are returning:',
    '- "rule" — you read a requirement. `rule` must be an object.',
    '- "none" — the sentence states no O\'level credit requirement at all, and',
    '  `rule` must be null. This is rare. Use it because the sentence has no',
    '  requirement in it, never because the sentence is hard or because subjects',
    '  were missing — a requirement you could not finish reading is "unreadable",',
    '  not "none".',
    '- "unreadable" — the sentence states a requirement you cannot return',
    '  faithfully, and `rule` must be null. Never guess on this path.',
    '',
    'Never invent a subject code, and never guess a requirement from the course',
    'name.',
    '',
    'Report `"confidence"` as "high" only if the sentence states the requirement',
    'unambiguously. If you had to interpret an ambiguous sentence, use "low" and',
    'still return your best reading — a low-confidence rule is recorded and',
    'checked later, which is more useful than no rule.',
    '',
    `Course: ${input.programme}`,
    `Institution: ${input.institution}`,
    '',
    'The brochure sentence, exactly as published:',
    input.sourceText,
  ].join('\n')
}
