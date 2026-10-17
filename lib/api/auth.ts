/**
 * API-key authentication for the catalogue API.
 *
 * The app had no inbound authentication of any kind before this — everything it
 * serves is either public (the app) or fetched by the server (Groq, IBASS). An
 * integration a partner calls from their own servers needs a credential, and
 * needs one that can be revoked in the morning without a code change.
 *
 * THREE PROPERTIES, each of which is a decision rather than a detail:
 *
 *   1. The keyring is an environment variable read at request time, so rotating
 *      a key is a redeploy of configuration and never a rebuild. It is NOT
 *      prefixed `NEXT_PUBLIC_` — the rule this repo already states for
 *      `GROQ_API_KEY` in the README applies here with more force, because a key
 *      inlined into a browser bundle is a key given away.
 *
 *   2. It FAILS CLOSED. An unset or empty keyring returns `unconfigured`, which
 *      the routes answer with 503 — never an open door. A deployment that
 *      forgot the variable serves an error; it does not silently publish the
 *      catalogue to the internet and leave nobody any the wiser.
 *
 *   3. Comparison is constant-time. The keys are compared as SHA-256 digests
 *      rather than as strings: `timingSafeEqual` throws on unequal lengths, so
 *      comparing raw keys would either throw on a wrong-length guess or need a
 *      length check that leaks the length. Hashing first makes every comparison
 *      32 bytes and every failure indistinguishable.
 *
 * Uses `node:crypto`, which pins these routes to the Node runtime — the default
 * for a Next.js route handler. Moving them to the edge would mean Web Crypto and
 * an async authorise; nothing here is hot enough to be worth that.
 */

import { createHash, timingSafeEqual } from 'node:crypto'

/** The environment variable holding the keyring. Server-side only. */
export const API_KEY_ENV = 'CATALOGUE_API_KEYS'

export type AuthOutcome =
  /** The presented key is one of ours. `keyId` is safe to log. */
  | { status: 'ok'; keyId: string }
  /** No keyring configured. The caller gets 503, not 401 — this is our fault. */
  | { status: 'unconfigured' }
  /** No key presented, or one that is not ours. */
  | { status: 'rejected' }

/**
 * The keys this deployment accepts.
 *
 * Comma-separated so a second integrator can be added, or a key rotated, without
 * taking the first one down — add the new key, deploy, migrate the client,
 * remove the old one. Blank entries and surrounding whitespace are dropped, so a
 * trailing comma or a stray space in a dashboard field is not an outage.
 */
export function configuredKeys(env: Record<string, string | undefined> = process.env): string[] {
  return (env[API_KEY_ENV] ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
}

/**
 * The key a request presents, from either accepted header.
 *
 * Two headers because two conventions are in common use and a partner should not
 * have to read our docs to guess which: `Authorization: Bearer <key>` is what an
 * HTTP client library does by default, and `x-api-key` is what most API
 * dashboards show in their sample snippet. `Authorization` wins when both are
 * present, so a client that sets a key of its own there is not silently
 * authenticated by a stale `x-api-key` beside it.
 */
export function presentedKey(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (authorization) {
    const match = /^Bearer[ \t]+(.+)$/i.exec(authorization.trim())
    if (match?.[1]) return match[1].trim()
  }

  const header = request.headers.get('x-api-key')?.trim()
  return header || null
}

/** Every comparison runs on this, so no comparison leaks a length. */
function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/**
 * A stable, non-reversible label for a key.
 *
 * Used as the rate limiter's bucket and as the identity in a log line, so the
 * key itself never has to be written down anywhere. Twelve hex characters is 48
 * bits — collision is not a concern at this scale, and it is short enough to
 * read out in a support thread.
 */
export function keyId(key: string): string {
  return digest(key).toString('hex').slice(0, 12)
}

export function authorise(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): AuthOutcome {
  const keys = configuredKeys(env)
  if (!keys.length) return { status: 'unconfigured' }

  const presented = presentedKey(request)
  if (!presented) return { status: 'rejected' }

  const offered = digest(presented)
  // No early exit. Every configured key is compared even after a match, so the
  // time taken does not say which key matched or how far down the list it sat.
  const matched = keys.reduce((found, candidate) => {
    const isMatch = timingSafeEqual(offered, digest(candidate))
    return isMatch ? candidate : found
  }, '' as string)

  return matched ? { status: 'ok', keyId: keyId(matched) } : { status: 'rejected' }
}
