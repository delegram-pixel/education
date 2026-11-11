'use server'

import { redirect } from 'next/navigation'

import { limitAction } from '@/lib/action-limits'
import { dbConfigured } from '@/lib/db'
import { deleteSessionData } from '@/lib/db/queries'
import { clearSessionId, ensureSessionId } from '@/lib/session'

/**
 * Delete everything this browser's session has stored.
 *
 * A Server Action is a public endpoint, so it re-derives the session from the
 * cookie rather than trusting a session id sent by the caller. The cookie is
 * cleared afterwards: keeping the same identity after deleting its data makes
 * the deletion look undone the next time anything is saved.
 */
export async function deleteMyData() {
  const sessionId = await ensureSessionId()

  const limit = limitAction('delete-data', sessionId)
  if (!limit.allowed) redirect('/privacy?deleted=rate')

  const deleted = await deleteSessionData(sessionId)

  if (!dbConfigured) {
    await clearSessionId()
    redirect('/privacy?deleted=none')
  }

  if (!deleted) {
    // Keep the session id so the visitor can retry against the same rows.
    redirect('/privacy?deleted=error')
  }

  await clearSessionId()
  redirect('/privacy?deleted=ok')
}
