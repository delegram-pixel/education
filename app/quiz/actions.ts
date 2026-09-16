'use server'

import { savePersonaResult } from '@/lib/db/queries'
import { ensureSessionId } from '@/lib/session'
import type { PersonaProfile } from '@/lib/types'

/**
 * Persist a completed quiz.
 *
 * Called fire-and-forget from the client once results are already on screen.
 * Scoring is pure and runs in the browser, so the student never waits on this,
 * and a failure costs nothing they can see.
 */
export async function savePersona(input: {
  answers: Record<string, number>
  profile: PersonaProfile
  alignmentByCourse: Record<string, number>
}): Promise<void> {
  const sessionId = await ensureSessionId()
  await savePersonaResult({ sessionId, ...input })
}
