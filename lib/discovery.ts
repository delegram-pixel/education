/**
 * Course discovery: which programmes list the subjects a student has.
 *
 * Deliberately pure and I/O-free, for the same reason `lib/eligibility/engine.ts`
 * is — this is the part worth unit-testing, so the fetching lives in
 * `lib/db/discovery.ts` and the matching lives here.
 *
 * WHAT THIS IS NOT: a verdict. Discovery works from subject *names* only; it has
 * no grades, so it cannot say whether anyone qualifies. A programme that lists
 * Biology and Chemistry is a programme worth looking at, not a place the student
 * has a seat. Only the reviewed courses in `lib/db/courses.data.ts` carry rules
 * the engine can decide on, which is why the one thing discovery does assert is
 * a link into the checker for exactly those.
 */

import { normaliseSubject } from '@/lib/subjects'
import { SUBJECTS, type Course, type SubjectCode } from '@/lib/types'

/** A catalogue row, reduced to what matching needs. */
export type ProgrammeSource = {
  institution: string
  programme: string
  department: string | null
  /** Subject labels exactly as published, not normalised. */
  utmeSubjects: string[]
  sourceUrl: string
  /** Set when this row is already backed by a reviewed course. */
  reviewedCourseId?: string | null
}

export type DiscoveryMatch = {
  /** Stable key — also used as the React key. */
  id: string
  programme: string
  institution: string
  department: string | null
  /** As published, for display. */
  utmeSubjects: string[]
  /** The student's subjects that this programme lists. */
  matched: SubjectCode[]
  /** Subjects the programme lists that the student did not name. */
  alsoNeeds: string[]
  sourceUrl: string
  /** Non-null when the checker has reviewed this programme. */
  reviewedCourseId: string | null
}

const SUBJECT_ORDER = Object.keys(SUBJECTS) as SubjectCode[]

function bySubjectOrder(a: SubjectCode, b: SubjectCode): number {
  return SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b)
}

/**
 * Loose key for "is this catalogue row the course we reviewed?".
 *
 * Only ever used to join a mirrored IBASS row to a reviewed course, so it
 * compares whole normalised names — an approximate match here would attach a
 * real verdict to a programme nobody reviewed.
 */
export function nameKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * `${nameKey(institution)}|${nameKey(programme)}` → the reviewed course id.
 *
 * Shared by the subject search and the by-school view so both resolve a mirrored
 * row to a reviewed course the same way. Two different answers here would mean a
 * programme offering a checker link in one place and not the other.
 */
export function reviewedCourseIndex(courses: Course[]): Map<string, string> {
  return new Map(
    courses.map((course) => [`${nameKey(course.institution)}|${nameKey(course.name)}`, course.id]),
  )
}

/**
 * Programmes listing at least one of `subjects`, best overlap first.
 *
 * Returns every match, unsliced: how many to *show* is a presentation decision,
 * and a caller that truncates needs the total to say so honestly. Ties break
 * towards reviewed courses, because those are the ones the student can actually
 * act on — everywhere else the only next step is "go and check IBASS yourself".
 */
export function matchProgrammes(
  programmes: ProgrammeSource[],
  subjects: SubjectCode[],
  options: { courses?: Course[] } = {},
): DiscoveryMatch[] {
  const { courses = [] } = options
  if (!subjects.length) return []

  const wanted = new Set(subjects)
  const reviewedByKey = reviewedCourseIndex(courses)

  const matches: DiscoveryMatch[] = []
  const seen = new Set<string>()

  for (const programme of programmes) {
    const key = `${nameKey(programme.institution)}|${nameKey(programme.programme)}`
    // A reviewed course and a mirrored row can describe the same programme.
    // Whichever comes first wins, rather than listing it twice.
    if (seen.has(key)) continue

    const matched = new Set<SubjectCode>()
    const alsoNeeds: string[] = []

    for (const label of programme.utmeSubjects) {
      const code = normaliseSubject(label)
      if (code && wanted.has(code)) {
        matched.add(code)
      } else {
        // Includes labels our dictionary does not know. They are still part of
        // what the programme asks for, so they belong in front of the student.
        alsoNeeds.push(label)
      }
    }

    if (matched.size === 0) continue

    seen.add(key)
    matches.push({
      id: key,
      programme: programme.programme,
      institution: programme.institution,
      department: programme.department,
      utmeSubjects: programme.utmeSubjects,
      matched: [...matched].sort(bySubjectOrder),
      alsoNeeds,
      sourceUrl: programme.sourceUrl,
      reviewedCourseId: programme.reviewedCourseId ?? reviewedByKey.get(key) ?? null,
    })
  }

  matches.sort(
    (a, b) =>
      b.matched.length - a.matched.length ||
      Number(b.reviewedCourseId !== null) - Number(a.reviewedCourseId !== null) ||
      a.institution.localeCompare(b.institution) ||
      a.programme.localeCompare(b.programme),
  )

  return matches
}
