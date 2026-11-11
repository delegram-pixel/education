/**
 * The daily ceiling on fresh rule reads.
 *
 * This is the backstop that actually bounds spend. Every per-session limit in
 * `lib/action-limits.ts` lives in one instance's memory, so a caller spread
 * across instances, or simply a new cookie, multiplies it. A row in Postgres
 * does not.
 *
 * The counter is incremented immediately before the model call, after the cache
 * and the "no requirement text" checks, so only work that could cost money is
 * counted. One slot is charged per read attempt; `lib/rules/model.ts` may retry
 * once after a 429 or a network error, so provider attempts can be up to twice
 * this number. The row is claimed with a single upsert, which is atomic across
 * instances; two simultaneous calls can therefore overshoot the limit by at
 * most the number of concurrent requests, and a ceiling that is occasionally
 * one call high is a very different thing from no ceiling at all.
 *
 * FAILS CLOSED. If the counter cannot be written — a missing table, a database
 * outage — a fresh read is refused rather than allowed. The feature's own
 * promise is that a rule is read once and stored; an uncounted read breaks the
 * only bound we have, and the student sees the ordinary unreviewed panel.
 */

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { getEnv } from '@/lib/env'

export type BudgetDecision = {
  allowed: boolean
  used: number
  limit: number
  reason?: 'no-database' | 'exhausted' | 'error'
}

export async function consumeRuleReadBudget(): Promise<BudgetDecision> {
  const limit = getEnv().GROQ_DAILY_CALL_LIMIT

  if (!db) return { allowed: false, used: 0, limit, reason: 'no-database' }

  try {
    const result = await db.execute<{ calls: number }>(sql`
      INSERT INTO model_call_budget (day, calls)
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT (day) DO UPDATE
        SET calls = model_call_budget.calls + 1,
            updated_at = now()
      RETURNING calls
    `)

    const used = Number(result.rows[0]?.calls ?? 0)
    if (used > limit) {
      return { allowed: false, used, limit, reason: 'exhausted' }
    }

    return { allowed: true, used, limit }
  } catch (error) {
    console.warn('[budget] could not claim a model-read budget slot:', error)
    return { allowed: false, used: 0, limit, reason: 'error' }
  }
}
