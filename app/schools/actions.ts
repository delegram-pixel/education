'use server'

import { listProgrammesForInstitution } from '@/lib/db/catalogue'
import { readRule } from '@/lib/db/rules'
import type { ProgrammeRuleStatus } from '@/lib/types'

/** One row of a school's programme list, reduced to what the card renders. */
export type InstitutionProgramme = {
  programme: string
  department: string | null
  utmeSubjects: string[]
  sourceUrl: string
  /** Non-null when the checker has reviewed this programme. */
  reviewedCourseId: string | null
  /** The mirror's id, which is what a rule is read and stored against. */
  programmeId: string | null
  /** Whether a rule has already been read for it. */
  ruleStatus: ProgrammeRuleStatus | null
}

export type InstitutionProgrammesState =
  | { status: 'error'; message: string }
  | { status: 'done'; programmes: InstitutionProgramme[]; source: 'ibass' | 'sample' }

/**
 * Load the programmes one institution lists.
 *
 * On demand rather than shipped with the page: the institution list runs to
 * hundreds of rows and each can carry dozens of programmes, so sending the whole
 * catalogue to the browser to render one school at a time would cost megabytes
 * to answer a question about one of them.
 *
 * Returns no verdict and cannot — see `lib/db/catalogue.ts`. A reviewed
 * programme carries the course id that links into the checker; everything else
 * carries its source URL and nothing more.
 */
export async function loadInstitutionProgrammes(
  name: string,
): Promise<InstitutionProgrammesState> {
  const trimmed = name.trim()
  if (!trimmed) return { status: 'error', message: 'Pick a school first.' }

  const { programmes, source } = await listProgrammesForInstitution(trimmed)

  return {
    status: 'done',
    source,
    programmes: programmes.map((programme) => ({
      programme: programme.programme,
      department: programme.department,
      utmeSubjects: programme.utmeSubjects,
      sourceUrl: programme.sourceUrl,
      reviewedCourseId: programme.reviewedCourseId ?? null,
      programmeId: programme.programmeId ?? null,
      ruleStatus: programme.ruleStatus ?? null,
    })),
  }
}

export type CourseRuleState = { status: 'ready' } | { status: 'unavailable' }

/**
 * Read a course's O-level requirement out of the brochure, if nobody has yet.
 *
 * Called when a student settles on a course in the picker. This is the moment
 * the whole feature is built around: the first student at a course waits a few
 * seconds and pays for one model call, the rule is stored, and every student
 * after them reads one row and gets an instant verdict. Coverage therefore grows
 * exactly where students actually go.
 *
 * Both answers are ordinary. `'unavailable'` covers a course whose brochure
 * sentence says nothing countable, a read that failed, and a deployment with no
 * `GROQ_API_KEY` at all — the caller renders the same "we have not reviewed
 * this" panel for all three, which is honest in every case. They are no longer
 * indistinguishable to *us*, though: `lib/db/rules.ts` logs the reason against
 * the programme's own name, and `yarn rules:read` prints the same reasons for a
 * whole school at once. Telling them apart in the UI would only invite it to
 * promise a retry it cannot make; not telling them apart anywhere is how a
 * night of guesses gets spent.
 *
 * The id is not trusted. It comes from the browser, and `readRule` resolves it
 * against `catalogue_programmes`, so an id that names nothing returns null and
 * costs one query.
 */
export async function readCourseRule(programmeId: string): Promise<CourseRuleState> {
  const id = programmeId.trim()
  // Only a mirrored programme id carries the colon. Anything else — a reviewed
  // course slug, a hand-typed string — has no brochure row to read.
  if (!id.includes(':')) return { status: 'unavailable' }

  const { rule } = await readRule(id)

  return rule?.rule ? { status: 'ready' } : { status: 'unavailable' }
}
