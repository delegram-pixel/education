/**
 * Catalogue rows, as the API publishes them.
 *
 * The read side (`lib/db/catalogue.ts`) returns `Date` objects, optional fields
 * whose absence means "not read", and ids that are null on some rows and not
 * others. A client cannot use any of that as it stands: a `Date` serialises to
 * whatever the runtime feels like, an absent field is indistinguishable from a
 * null one once it is JSON, and a null id is a link that goes nowhere.
 *
 * So every field a client sees is normalised here, once, rather than in each
 * route. The rules are:
 *
 *   - Every instant is an ISO 8601 string in UTC.
 *   - Every field is present. A value we do not hold is `null`, never missing,
 *     so a client can read it without a guard and a schema generated from the
 *     OpenAPI document matches what actually arrives.
 *   - Every id is resolvable. `programmeRef` and `institutionSlug` supply one
 *     where the mirror did not.
 *
 * Pure and I/O-free, like `lib/institutions.ts` and for the same reason: this is
 * the part worth testing, and none of it needs a database to be true.
 */

import {
  institutionSlug,
  programmeRef,
  type CatalogueInstitution,
  type SwiftKnowledgeProgramme,
} from '@/lib/db/catalogue'
import { shortInstitutionName } from '@/lib/institutions'
import {
  ALWAYS_REQUIRED,
  GRADE_MEANING,
  GRADES,
  SUBJECTS,
  isCredit,
  type Grade,
  type ProgrammeRuleStatus,
  type SubjectCode,
} from '@/lib/types'

/* -------------------------------------------------------------------------- */
/* Institutions                                                                */
/* -------------------------------------------------------------------------- */

export type InstitutionView = {
  id: string
  /** The name as the brochure prints it — often "NAME, CITY, STATE". */
  name: string
  /**
   * The same name as a sentence refers to it.
   *
   * Carried because a client composing "does {name} offer Nursing?" from the
   * full name produces "does UNIVERSITY OF CALABAR, CALABAR, CROSS RIVER STATE
   * offer Nursing?", which is not a sentence anybody writes. `lib/institutions`
   * already computes this for the app's own prose; this is the same helper, so
   * the two cannot disagree about what a school is called.
   */
  shortName: string
  type: string | null
  category: string | null
  /** Null when the catalogue records none — which is not a state named "". */
  state: string | null
  /**
   * How many programmes this catalogue currently holds for the institution.
   *
   * WHAT IT IS NOT: how many the school offers, and not a statement that any of
   * them will admit anyone. Every response it appears in says so — see
   * `CATALOGUE_DISCLAIMER`.
   */
  programmeCount: number
  sourceUrl: string
  sourceUpdatedAt: string
}

export function institutionView(institution: CatalogueInstitution): InstitutionView {
  return {
    id: institution.id,
    name: institution.name,
    shortName: shortInstitutionName(institution.name),
    type: institution.institutionType,
    category: institution.category,
    state: institution.state,
    programmeCount: institution.programmeCount,
    sourceUrl: institution.sourceUrl,
    sourceUpdatedAt: institution.sourceUpdatedAt.toISOString(),
  }
}

/* -------------------------------------------------------------------------- */
/* Programmes                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A programme as a listing carries it.
 *
 * No requirement prose. The prose is the single largest thing in a catalogue row
 * and a list of thirty search results renders none of it — `PROSE_COLUMNS` in
 * `lib/db/catalogue.ts` makes the same argument about the same column, and this
 * is that decision seen from the client's side.
 */
export type ProgrammeSummary = {
  id: string
  institutionId: string
  institution: string
  institutionShort: string
  name: string
  department: string | null
  /** IBASS's own status line for the programme, quoted. */
  status: string | null
  /**
   * The UTME combination exactly as IBASS publishes it — names, not codes.
   *
   * Deliberately not mapped to this catalogue's subject codes. The brochure
   * writes "Government/History" and "Data Processing/Computer Studies", which
   * have no code, and mapping the entries that do have one would silently drop
   * the ones that do not — turning a four-subject combination into a
   * three-subject one. `lib/types.ts` records the same reasoning for the field
   * this is read from.
   */
  utmeSubjects: string[]
  sourceUrl: string
  sourceUpdatedAt: string
  /**
   * The reviewed course this programme resolves to, when the checker holds one.
   *
   * Null is the ordinary case: the checker has reviewed a handful of courses and
   * the catalogue holds twenty thousand programmes, so most rows lead to the
   * brochure and nothing else. A client should offer a check only where this is
   * non-null — see `checkerUrl`.
   */
  reviewedCourseId: string | null
  /**
   * Whether a requirement has already been read for this programme.
   *
   * `'ready'` — a rule was read and the checker can decide on it. `'no-source'`
   * — reading was done and the brochure states no O'level requirement, so the
   * programme is settled and will not be read again. `null` — nobody has looked;
   * the first student to ask will wait for a read.
   */
  ruleStatus: ProgrammeRuleStatus | null
}

/**
 * A programme as a detail read carries it — the list fields, plus the prose.
 *
 * Every prose field is the brochure's own words, quoted, and `sourceUrl` is
 * where they came from. Nothing here is a reading of ours, and nothing here is a
 * decision: see the note on `checkerUrl`.
 */
export type ProgrammeDetail = ProgrammeSummary & {
  olevelRequirements: string | null
  directEntryRequirements: string | null
  /** IBASS's own remarks. Quoted, like the rest. */
  remarks: string | null
  /**
   * A link into the app's eligibility checker, when there is one to offer.
   *
   * Null when the checker holds no reviewed course for this programme, which is
   * the usual case.
   *
   * WHY A LINK AND NOT AN ANSWER: this API may not present a verdict. Only the
   * in-app checker may, working from reviewed rules, and it says which of the
   * two it used — see `CheckTarget.provenance` in `lib/types.ts`. So the useful,
   * honest thing to hand a client is the route to the decision rather than a
   * decision made somewhere the student cannot see the reasoning. An agent that
   * quotes the requirements *and* links into the checker gives a student both
   * halves of the answer without either half overreaching.
   */
  checkerUrl: string | null
}

function base(programme: SwiftKnowledgeProgramme): ProgrammeSummary {
  return {
    id: programmeRef(programme),
    institutionId:
      programme.institutionId ?? institutionSlug(programme.institution),
    institution: programme.institution,
    institutionShort: shortInstitutionName(programme.institution),
    name: programme.programme,
    department: programme.department,
    status: programme.status,
    utmeSubjects: programme.utmeSubjects,
    sourceUrl: programme.sourceUrl,
    sourceUpdatedAt: programme.sourceUpdatedAt.toISOString(),
    reviewedCourseId: programme.reviewedCourseId ?? null,
    ruleStatus: programme.ruleStatus ?? null,
  }
}

export function programmeSummary(programme: SwiftKnowledgeProgramme): ProgrammeSummary {
  return base(programme)
}

/**
 * The checker's address for a course, or null when there is nothing to open.
 *
 * `baseUrl` is passed in rather than read from the environment here, so this
 * module stays pure and a caller decides what address the app is reachable at.
 */
export function checkerUrl(
  reviewedCourseId: string | null,
  baseUrl: string | null,
): string | null {
  if (!reviewedCourseId || !baseUrl) return null
  return `${baseUrl}/check?course=${encodeURIComponent(reviewedCourseId)}`
}

export function programmeDetail(
  programme: SwiftKnowledgeProgramme,
  baseUrl: string | null,
): ProgrammeDetail {
  const summary = base(programme)

  return {
    ...summary,
    olevelRequirements: programme.olevelRequirements ?? null,
    directEntryRequirements: programme.directEntryRequirements ?? null,
    remarks: programme.remarks ?? null,
    checkerUrl: checkerUrl(summary.reviewedCourseId, baseUrl),
  }
}

/**
 * Where the app is reachable, for links handed to a client.
 *
 * `APP_BASE_URL` when set, and the request's own origin otherwise, so the API
 * works in development and in a preview deployment with no configuration. The
 * fallback reads the `Host` header, which a caller controls — which is why the
 * variable exists and why it is documented as the thing to set in production. A
 * spoofed host can only put a wrong link in a JSON body; it cannot reach
 * anything, because nothing here fetches the URL it just built.
 */
export function resolveBaseUrl(request: Request): string | null {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured

  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

export type SubjectView = { code: SubjectCode; name: string }

export type GradeView = {
  code: Grade
  /**
   * Whether this grade satisfies a subject requirement.
   *
   * The one rule a client cannot be left to guess. A1–C6 are credits; D7 and E8
   * are passes that satisfy nothing; F9 is a fail. Every eligibility bug this
   * codebase warns about comes from treating a pass as a credit, and a client
   * that infers its own table will make exactly that mistake.
   */
  credit: boolean
  meaning: string
}

/**
 * The subject and grade vocabulary, so a client can map what a student types.
 *
 * Small, static, and served rather than documented because getting it wrong is
 * silent: a client that never learns "MTH" means Mathematics does not fail, it
 * just matches nothing.
 */
export function subjectVocabulary(): {
  subjects: SubjectView[]
  grades: GradeView[]
  /** Subjects every course requires — English Language and Mathematics. */
  alwaysRequired: SubjectCode[]
} {
  return {
    subjects: (Object.keys(SUBJECTS) as SubjectCode[]).map((code) => ({
      code,
      name: SUBJECTS[code],
    })),
    grades: GRADES.map((code) => ({
      code,
      credit: isCredit(code),
      meaning: GRADE_MEANING[code],
    })),
    alwaysRequired: ALWAYS_REQUIRED,
  }
}
