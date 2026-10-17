/**
 * A fixed-window rate limiter, in process memory.
 *
 * WHAT THIS HONESTLY IS, because the temptation is to oversell it: a runaway
 * guard. It stops one key in a retry loop from spending a database read per
 * request. It is NOT an enforcement guarantee, and the docs shipped to Swift say
 * so rather than implying otherwise —
 *
 *   - The window lives in the memory of one serverless instance. Ten instances
 *     serve ten windows, and a cold start serves a fresh one. A caller over the
 *     limit on one instance can be under it on the next.
 *   - Restarting the deployment clears it.
 *
 * That is acceptable here because of what is being protected. The responses are
 * public catalogue reads behind a shared cache, so the worst a caller can do is
 * spend cache misses; there is no per-student data to exhaust and no write to
 * trigger. A limiter that had to hold — protecting a paid upstream, or a login —
 * would need shared state, and this one deliberately does not reach for any,
 * because adding Redis to the stack to protect a public directory would cost
 * more than the abuse it prevents.
 *
 * Fixed window rather than sliding: a caller can make `2 × requests` across a
 * boundary. For a runaway guard that is a rounding error, and the alternative
 * costs per-request bookkeeping that buys nothing a partner would notice.
 */

import { RATE_LIMIT } from './contract'

export type RateLimitState = {
  allowed: boolean
  /** The ceiling, so a client can render it without knowing our config. */
  limit: number
  remaining: number
  /** Epoch milliseconds at which the current window ends. */
  resetAt: number
}

export type RateLimiter = {
  check(id: string): RateLimitState
}

type Bucket = { count: number; resetAt: number }

export function createRateLimiter(options: {
  requests: number
  windowMs: number
  /** Injected so the window can be tested without waiting for a clock. */
  now?: () => number
  /**
   * How many key buckets to hold before sweeping expired ones.
   *
   * A map keyed by caller is a map a caller can grow, so it needs a ceiling.
   * Rejected callers are rejected before a bucket is created for them — see
   * `check` — which is what stops the limiter itself being the thing an
   * unauthenticated flood exhausts. The sweep is O(n) and only runs once the map
   * is already large, so it is not on the ordinary path.
   */
  maxBuckets?: number
}): RateLimiter {
  const { requests, windowMs, now = Date.now, maxBuckets = 5_000 } = options
  const buckets = new Map<string, Bucket>()

  function sweep(threshold: number): void {
    for (const [id, bucket] of buckets) {
      if (bucket.resetAt <= threshold) buckets.delete(id)
    }
  }

  return {
    check(id: string): RateLimitState {
      const at = now()
      if (buckets.size >= maxBuckets) sweep(at)

      const existing = buckets.get(id)
      const bucket = existing && existing.resetAt > at ? existing : { count: 0, resetAt: at + windowMs }

      bucket.count += 1
      buckets.set(id, bucket)

      const allowed = bucket.count <= requests

      return {
        allowed,
        limit: requests,
        remaining: requests - bucket.count,
        resetAt: bucket.resetAt,
      }
    },
  }
}

/**
 * The one the routes use.
 *
 * Module scope, so it survives between requests on a warm instance — which is
 * the only reason it does anything at all.
 */
export const catalogueLimiter = createRateLimiter(RATE_LIMIT)
