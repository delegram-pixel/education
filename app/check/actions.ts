'use server'

import { checkEligibility } from '@/lib/eligibility/engine'
import { findCourse, saveCheck } from '@/lib/db/queries'
import { ensureSessionId } from '@/lib/session'
import { resultSetSchema, type OLevelResult, type Verdict } from '@/lib/types'

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
  const course = await findCourse(courseId)
  if (!course) {
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

  const verdict = checkEligibility(course, parsed.data)

  const sessionId = await ensureSessionId()
  const shareId = await saveCheck({ sessionId, courseId, results: parsed.data, verdict })

  return { status: 'done', verdict, courseId, shareId }
}
