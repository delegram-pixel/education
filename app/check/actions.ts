'use server'

import { searchProgrammes } from '@/lib/db/discovery'
import { checkEligibility } from '@/lib/eligibility/engine'
import { findCheckTarget, saveCheck } from '@/lib/db/queries'
import { ensureSessionId } from '@/lib/session'
import type { DiscoveryMatch } from '@/lib/discovery'
import {
  SUBJECT_CODES,
  resultSetSchema,
  type OLevelResult,
  type SubjectCode,
  type Verdict,
} from '@/lib/types'

export type CheckState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'done'
      verdict: Verdict
      courseId: string
      /** Present only when the result was persisted and can therefore be shared. */
      shareId: string | null
    }

/**
 * Run an eligibility check.
 *
 * The verdict is computed before anything is persisted, and returned whether or
 * not the write succeeds. A student who asked whether they qualify gets their
 * answer even if the database is unreachable; all they lose is the share link.
 */
export async function runCheck(courseId: string, results: OLevelResult[]): Promise<CheckState> {
  const target = await findCheckTarget(courseId)
  if (!target) {
    return { status: 'error', message: 'We could not find that course. Please pick it again.' }
  }

  const parsed = resultSetSchema.safeParse(results)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      status: 'error',
      message: first?.message ?? 'Please check the subjects and grades you entered.',
    }
  }

  const verdict = checkEligibility(target, parsed.data)

  const sessionId = await ensureSessionId()
  const shareId = await saveCheck({ sessionId, courseId, results: parsed.data, verdict })

  return { status: 'done', verdict, courseId, shareId }
}

/* -------------------------------------------------------------------------- */
/* Course discovery                                                            */
/* -------------------------------------------------------------------------- */

export type DiscoveryState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'done'
      matches: DiscoveryMatch[]
      /** Total matches before truncation, so the UI can be honest about the cap. */
      total: number
      /** Where the catalogue came from — surfaced so the UI can be honest about reach. */
      source: 'ibass' | 'sample'
      subjects: SubjectCode[]
    }

/**
 * Find programmes that list the subjects a student has.
 *
 * The subjects arrive from the client as codes the chip picker produced, but
 * they are re-validated here against `SUBJECT_CODES` — a server action is a
 * public endpoint, and the matcher should never be handed a code that is not
 * real.
 *
 * This deliberately returns no verdict, and could not: it has subject names and
 * no grades. The strongest thing it can offer is a link into the checker.
 */
export async function discoverCourses(subjects: string[]): Promise<DiscoveryState> {
  const known = new Set<string>(SUBJECT_CODES)
  const valid = subjects.filter((subject): subject is SubjectCode => known.has(subject))
  const unique = SUBJECT_CODES.filter((code) => valid.includes(code))

  if (!unique.length) {
    return { status: 'error', message: 'Add at least one subject to search with.' }
  }

  const { matches, total, source } = await searchProgrammes(unique)

  return { status: 'done', matches, total, source, subjects: unique }
}
