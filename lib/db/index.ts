/**
 * Neon client.
 *
 * The HTTP driver is used rather than a pooled TCP connection because every
 * request in this app is its own serverless invocation — a connection pool
 * would be exhausted long before the database was.
 *
 * `db` is null when DATABASE_URL is absent, and every caller must handle that.
 * This is not defensive padding: the requirement is that the core eligibility
 * flow works with no database at all, so that a demo never depends on a network
 * that might not be there.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

export const dbConfigured = Boolean(connectionString)

export const db = connectionString
  ? drizzle(neon(connectionString), { schema })
  : null

export { schema }

/**
 * Run a database read, falling back to static data if the database is absent or
 * unreachable. Failures are logged once and swallowed — a student checking their
 * eligibility does not need to see a Postgres error, and the answer they came
 * for does not depend on one.
 */
export async function withFallback<T>(
  label: string,
  query: (client: NonNullable<typeof db>) => Promise<T>,
  fallback: () => T,
): Promise<{ data: T; degraded: boolean }> {
  if (!db) return { data: fallback(), degraded: true }

  try {
    return { data: await query(db), degraded: false }
  } catch (error) {
    console.warn(`[db] ${label} failed, serving static data instead:`, error)
    return { data: fallback(), degraded: true }
  }
}

/**
 * Run a database write that the app can function without. Returns null on
 * failure rather than throwing, so a persistence outage never blocks a user
 * from seeing their result.
 */
export async function tryWrite<T>(
  label: string,
  mutation: (client: NonNullable<typeof db>) => Promise<T>,
): Promise<T | null> {
  if (!db) return null

  try {
    return await mutation(db)
  } catch (error) {
    console.warn(`[db] ${label} failed:`, error)
    return null
  }
}
