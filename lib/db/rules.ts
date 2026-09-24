/**
 * Reading, storing and reusing a programme's eligibility rule.
 *
 * The contract this module exists to keep: **a rule is read at most once per
 * programme, ever.** The first student to pick a course waits for the model and
 * pays for the call; every student after them reads one row and gets an instant
 * verdict. Coverage therefore grows exactly where students actually go, and
 * nowhere else — which is the right place for it to grow, and the reason this
 * is not a bulk job over twenty thousand programmes.
 *
 * Storage is what makes the difference, so with no database there is nothing to
 * gain: every request would re-read the same sentence and re-charge for it. With
 * `DATABASE_URL` unset this module therefore does nothing at all and callers
 * fall back to today's behaviour.
 *
 * The same goes for `GROQ_API_KEY`. No key means no reader, so the whole
 * feature is off and the app behaves exactly as it did before it existed —
 * including writing nothing. The guard is here rather than at each call site so
 * that "no key, no behaviour change" holds for every caller by construction,
 * rather than being something each one has to remember.
 */

import { eq } from 'drizzle-orm'

import { db, tryWrite } from '@/lib/db'
import { catalogueInstitutions, catalogueProgrammes, programmeRules } from '@/lib/db/schema'
import { askModelForRule, hasRuleReader, RULE_MODEL } from '@/lib/rules/model'
import { htmlToText, sourceHash, type RuleFailureReason } from '@/lib/rules/reader'
import type { OLevelRule, ProgrammeRuleStatus, RuleConfidence } from '@/lib/types'

/** A rule for one programme, with enough of the programme to describe it. */
export type ProgrammeRule = {
  programmeId: string
  status: ProgrammeRuleStatus
  /** Null exactly when `status` is 'no-source'. */
  rule: OLevelRule | null
  /** The programme's own name, as IBASS publishes it. */
  name: string
  institution: string
  department: string | null
}

/**
 * The model recorded for a programme we determined locally has nothing to read.
 *
 * Not a model name, because no model was consulted — writing one would claim a
 * provenance the row does not have.
 */
const NO_MODEL = 'none'

/**
 * The answer to "read this programme's rule", success or failure.
 *
 * The failure arm is what makes a bad night diagnosable. Every caller used to
 * get a bare `null` — no database, no key, a rate limit, a sentence no reader
 * could parse — and the four are fixed in four different ways. `reason` is the
 * same vocabulary `lib/rules/reader.ts` refuses a reply with, so a warm-up run
 * and a live request describe the same failure in the same words.
 */
export type RuleReadResult = {
  /** The rule to serve, when there is one. Null exactly when the read failed. */
  rule: ProgrammeRule | null
  /** Why there is no rule, when there is none. Null on success. */
  reason: RuleFailureReason | null
  /** Whatever the reason alone does not say — an HTTP status, a schema issue. */
  detail?: string
  /** True when this came out of the store rather than from a fresh read. */
  cached: boolean
}

/**
 * Calls already in flight, by programme.
 *
 * Two students picking the same course at the same moment would otherwise both
 * miss the cache, both call the model, and both insert. `onConflictDoNothing`
 * makes the second write harmless, but it does not stop the second *call*, and
 * the call is the part that costs money and takes seconds.
 */
const inFlight = new Map<string, Promise<RuleReadResult>>()

async function loadStored(programmeId: string): Promise<ProgrammeRule | null> {
  if (!db) return null

  try {
    // Joined rather than read from `programme_rules` alone, so a cache hit and a
    // fresh read come back as the same shape and the caller never has to make a
    // second query just to find out what the programme is called.
    const rows = await db
      .select({
        status: programmeRules.status,
        rule: programmeRules.olevelRule,
        name: catalogueProgrammes.name,
        institution: catalogueInstitutions.name,
        department: catalogueProgrammes.department,
      })
      .from(programmeRules)
      .innerJoin(catalogueProgrammes, eq(programmeRules.programmeId, catalogueProgrammes.id))
      .innerJoin(
        catalogueInstitutions,
        eq(catalogueProgrammes.institutionId, catalogueInstitutions.id),
      )
      .where(eq(programmeRules.programmeId, programmeId))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return {
      programmeId,
      status: row.status,
      rule: row.rule ?? null,
      name: row.name,
      institution: row.institution,
      department: row.department,
    }
  } catch (error) {
    console.warn('[rules] could not read a stored rule:', error)
    return null
  }
}

/** Persist a read. Failures are logged and swallowed — see `tryWrite`. */
async function store(
  programmeId: string,
  values: {
    status: ProgrammeRuleStatus
    rule: OLevelRule | null
    sourceText: string | null
    confidence: RuleConfidence
    model: string
  },
): Promise<void> {
  await tryWrite('saveProgrammeRule', (client) =>
    client
      .insert(programmeRules)
      .values({
        programmeId,
        olevelRule: values.rule,
        status: values.status,
        sourceText: values.sourceText,
        sourceHash: values.sourceText ? sourceHash(values.sourceText) : null,
        confidence: values.confidence,
        model: values.model,
      })
      // A racing request may have written the same row a moment ago. Either
      // reading is equally valid, so losing the race is not an error.
      .onConflictDoNothing({ target: programmeRules.programmeId }),
  )
}

/**
 * The rule for one programme, reading it if this is the first time anyone has
 * asked.
 *
 * Never throws and never returns nothing to say. The caller renders today's
 * "we have not reviewed this" panel whenever `rule` is null whatever the
 * reason, which is correct in every case — but the reason travels alongside it,
 * so the same event can be counted and named by whoever is watching rather than
 * being indistinguishable from every other way a read can fail.
 */
export async function readRule(programmeId: string): Promise<RuleReadResult> {
  if (!db) return { rule: null, reason: 'no-database', cached: false }
  if (!hasRuleReader()) {
    return { rule: null, reason: 'no-key', detail: 'GROQ_API_KEY is not configured', cached: false }
  }

  const stored = await loadStored(programmeId)
  if (stored) return { rule: stored, reason: null, cached: true }

  const existing = inFlight.get(programmeId)
  if (existing) return existing

  const pending = readAndStore(programmeId).finally(() => inFlight.delete(programmeId))
  inFlight.set(programmeId, pending)

  return pending
}

async function readAndStore(programmeId: string): Promise<RuleReadResult> {
  const rows = await (async () => {
    try {
      return await db!
        .select({
          name: catalogueProgrammes.name,
          institution: catalogueInstitutions.name,
          department: catalogueProgrammes.department,
          olevelRequirements: catalogueProgrammes.olevelRequirements,
        })
        .from(catalogueProgrammes)
        .innerJoin(
          catalogueInstitutions,
          eq(catalogueProgrammes.institutionId, catalogueInstitutions.id),
        )
        .where(eq(catalogueProgrammes.id, programmeId))
        .limit(1)
    } catch (error) {
      console.warn('[rules] could not load a programme:', error)
      return []
    }
  })()

  const programme = rows[0]
  if (!programme) {
    return { rule: null, reason: 'no-programme', detail: programmeId, cached: false }
  }

  const identity = {
    name: programme.name,
    institution: programme.institution,
    department: programme.department,
  }

  const sourceText = htmlToText(programme.olevelRequirements ?? '')

  // Phase 0's finding, encoded: if the brochure publishes no requirement text
  // there is nothing for any reader to read. Recording that costs one row and
  // saves a model call per student — and it is a fact we established ourselves,
  // so it is recorded without claiming a model or a reading.
  if (!sourceText) {
    await store(programmeId, {
      status: 'no-source',
      rule: null,
      sourceText: null,
      confidence: 'high',
      model: NO_MODEL,
    })
    return { rule: { programmeId, status: 'no-source', rule: null, ...identity }, reason: null, cached: false }
  }

  const read = await askModelForRule({
    programme: programme.name,
    institution: programme.institution,
    sourceText,
  })

  // A failed read is deliberately NOT stored. Storing it would mark this
  // programme unreadable forever on the strength of one bad response; leaving
  // the row absent means the next student's request tries again.
  //
  // It is logged, though, and with the programme named: this line is the only
  // record that a student ever asked and got nothing, and without it the only
  // way to find out which courses fail is to guess at them one at a time.
  if (read.status === 'failed') {
    console.warn(
      `[rules] could not read ${programme.name} (${programme.institution}) — ${read.reason}${
        read.detail ? `: ${read.detail}` : ''
      }`,
    )
    return { rule: null, reason: read.reason, detail: read.detail, cached: false }
  }

  await store(programmeId, {
    status: read.status,
    rule: read.rule,
    sourceText,
    confidence: read.confidence,
    model: RULE_MODEL,
  })

  return {
    rule: { programmeId, status: read.status, rule: read.rule, ...identity },
    reason: null,
    cached: false,
  }
}
