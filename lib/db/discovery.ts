/**
 * Discovery search — the I/O half.
 *
 * Reads the same catalogue document Swift is given (`listSwiftKnowledgeProgrammes`)
 * and hands it to the pure matcher in `lib/discovery.ts`. Nothing here decides
 * anything; it fetches, delegates, and reports where the data came from.
 *
 * The `source` flag is not an error state. Both paths give the student a real
 * answer; they differ in how much of Nigeria they cover, and saying which one
 * they got is the honest thing to do.
 */

import { listSwiftKnowledgeProgrammes } from '@/lib/db/catalogue'
import { listCourses } from '@/lib/db/queries'
import { matchProgrammes, type DiscoveryMatch, type ProgrammeSource } from '@/lib/discovery'
import type { SubjectCode } from '@/lib/types'

export type DiscoveryResult = {
  /** The matches to show, best overlap first. */
  matches: DiscoveryMatch[]
  /** How many matched in total, so a truncated list can say so. */
  total: number
  /** `ibass` when the mirror answered, `sample` when we fell back to constants. */
  source: 'ibass' | 'sample'
}

/** How many programmes discovery is willing to put on screen at once. */
const VISIBLE_LIMIT = 12

export async function searchProgrammes(
  subjects: SubjectCode[],
  limit: number = VISIBLE_LIMIT,
): Promise<DiscoveryResult> {
  const [{ programmes, source }, { data: courses }] = await Promise.all([
    listSwiftKnowledgeProgrammes(),
    listCourses(),
  ])

  const sources: ProgrammeSource[] = programmes.map((programme) => ({
    institution: programme.institution,
    programme: programme.programme,
    department: programme.department,
    utmeSubjects: programme.utmeSubjects,
    sourceUrl: programme.sourceUrl,
    reviewedCourseId: programme.reviewedCourseId ?? null,
  }))

  const all = matchProgrammes(sources, subjects, { courses })

  return {
    matches: all.slice(0, limit),
    total: all.length,
    source,
  }
}
