import { cookies } from 'next/headers'

/**
 * Anonymous sessions.
 *
 * There are no accounts in this MVP — deliberately. A student checking whether
 * they qualify for a course should not have to create a password first, and an
 * account would be the single largest drop-off point in the funnel.
 *
 * A visitor is instead a UUID in a cookie, readable by client code so that a
 * shared result link can be recognised as one's own.
 */

export const SESSION_COOKIE = 'ac_session'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Read the current session id, or null in a context that cannot set cookies. */
export async function getSessionId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(SESSION_COOKIE)?.value ?? null
}

/**
 * Read the session id, creating one if absent.
 *
 * Only callable from a Server Action or Route Handler — Server Components are
 * not permitted to write cookies. Reads during rendering should use
 * `getSessionId()` and tolerate null.
 */
export async function ensureSessionId(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get(SESSION_COOKIE)?.value
  if (existing) return existing

  const id = crypto.randomUUID()
  jar.set(SESSION_COOKIE, id, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return id
}
