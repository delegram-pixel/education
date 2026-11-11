/**
 * Limits for Server Actions.
 *
 * Every `'use server'` export is a public HTTP endpoint: anyone who can load
 * the app can call it directly, with whatever arguments they like. The catalogue
 * API already has a limiter; these are the app-side equivalent, and they exist
 * mainly to protect the one action that spends money.
 *
 * WHAT THIS IS AND IS NOT. These counters live in the memory of one instance,
 * so they stop a loop from one browser but cannot bound a bill across a fleet.
 * The bill is bounded by the Postgres daily budget in `lib/db/budget.ts`; this
 * file is the cheaper, earlier layer that keeps ordinary abuse away from the
 * database in the first place.
 *
 * Keys are session ids, never IP addresses. A session is the identity the app
 * actually has, and an IP is shared by a whole campus.
 */

import { createRateLimiter, type RateLimiter } from '@/lib/api/rate-limit'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Ten minutes between fresh reads of the same programme, per session. */
const PROGRAMME_WINDOW_MS = 10 * MINUTE

/** How long one failed read keeps that programme from being asked again. */
const FAILURE_COOLDOWN_MS = 10 * MINUTE

const limiters = {
  /** Fresh model reads. Deliberately low: a rule only needs reading once. */
  'rule-read': createRateLimiter({ requests: 20, windowMs: HOUR }),
  /** Ticket creation. Enough for a real problem, not for a loop. */
  ticket: createRateLimiter({ requests: 5, windowMs: HOUR }),
  'ticket-reply': createRateLimiter({ requests: 20, windowMs: HOUR }),
  /** Checks are cheap; this only stops a runaway client. */
  check: createRateLimiter({ requests: 30, windowMs: 10 * MINUTE }),
  persona: createRateLimiter({ requests: 10, windowMs: HOUR }),
  discovery: createRateLimiter({ requests: 60, windowMs: HOUR }),
  /** Programme lists are read-only, but they are a DB read per school. */
  'institution-programmes': createRateLimiter({ requests: 120, windowMs: HOUR }),
  'delete-data': createRateLimiter({ requests: 3, windowMs: HOUR }),
} satisfies Record<string, RateLimiter>

export type ActionName = keyof typeof limiters

export type LimitDecision = {
  allowed: boolean
  /** Milliseconds until the current window ends, or 0 when allowed. */
  retryAfterMs: number
}

export function limitAction(name: ActionName, sessionId: string): LimitDecision {
  const state = limiters[name].check(sessionId)
  if (state.allowed) return { allowed: true, retryAfterMs: 0 }

  // The session id is deliberately not logged. It is an anonymous identifier,
  // but it is still a visitor's, and the useful fact is which action tripped.
  console.warn(`[limit] ${name} rejected for this session until ${new Date(state.resetAt).toISOString()}`)

  return { allowed: false, retryAfterMs: Math.max(0, state.resetAt - Date.now()) }
}

/**
 * One fresh read per session per programme per ten minutes.
 *
 * Separate from the hourly cap because they answer different questions: this
 * one stops one bad programme being hammered, and the hourly one stops a walk
 * through many programme ids.
 */
const programmeWindow = createRateLimiter({
  requests: 1,
  windowMs: PROGRAMME_WINDOW_MS,
  maxBuckets: 2_000,
})

export function checkRuleReadAllowance(
  sessionId: string | null | undefined,
  programmeId: string,
): LimitDecision {
  // A render path that cannot write cookies has no session to limit against;
  // the database budget still applies to it.
  if (!sessionId) return { allowed: true, retryAfterMs: 0 }

  const programmeState = programmeWindow.check(`${sessionId}:${programmeId}`)
  if (!programmeState.allowed) {
    return { allowed: false, retryAfterMs: Math.max(0, programmeState.resetAt - Date.now()) }
  }

  return limitAction('rule-read', sessionId)
}

/**
 * Recently failed programmes, in process memory.
 *
 * A failed read is not stored, on purpose, so a programme no reader can parse
 * would otherwise be retried on every request forever. The cooldown is short
 * enough that a transient provider failure heals itself and long enough that a
 * hard sentence cannot be used as a free model-call generator.
 *
 * Keyed by programme rather than by session: the thing being protected is the
 * programme's model call, and every session asking for it would pay again.
 */
const failureCooldown = new Map<string, number>()
const MAX_COOLDOWN_ENTRIES = 2_000

function sweepCooldowns(now: number): void {
  if (failureCooldown.size < MAX_COOLDOWN_ENTRIES) return
  for (const [programmeId, until] of failureCooldown) {
    if (until <= now) failureCooldown.delete(programmeId)
  }
}

export function noteRuleReadFailure(programmeId: string): void {
  const now = Date.now()
  sweepCooldowns(now)
  failureCooldown.set(programmeId, now + FAILURE_COOLDOWN_MS)
}

/** True while a programme is inside the wake after a failed read. */
export function ruleReadCoolingDown(programmeId: string): boolean {
  const until = failureCooldown.get(programmeId)
  if (!until) return false

  if (until <= Date.now()) {
    failureCooldown.delete(programmeId)
    return false
  }

  return true
}

/** Exposed for tests only. */
export function resetLimitStateForTests(): void {
  failureCooldown.clear()
}
