/**
 * The wrapper every `/api/v1` route runs inside.
 *
 * Seven routes share four steps — authenticate, rate limit, parse the URL, and
 * turn a thrown error into the documented envelope — and repeating them per
 * route is how one of them ends up missing a check. Doing it once means a route
 * file contains only what is specific to that route: which reader to call and
 * how to shape the answer.
 *
 * It also fixes the ORDER, which matters and is easy to get wrong by hand.
 * Authentication comes before the rate limit, because the limit is keyed on an
 * authenticated identity — limiting first would bucket every anonymous caller
 * together and let one of them spend everybody's quota. And both come before the
 * handler, so an unauthenticated request never reaches the database.
 */

import { authorise, type AuthOutcome } from './auth'
import { fail, rateLimitHeaders, retryAfter } from './respond'
import { catalogueLimiter, type RateLimiter } from './rate-limit'
import { resolveBaseUrl } from './views'

export type ApiContext = {
  /** The authenticated key's label. Safe to log; never the key itself. */
  keyId: string
  url: URL
  /** Where the app is reachable, for links handed back to a client. */
  baseUrl: string | null
}

type Options = {
  env?: Record<string, string | undefined>
  limiter?: RateLimiter
}

/**
 * An unconfigured keyring is a 503, not a 401.
 *
 * The distinction is whose fault it is. A 401 tells a client "your credential
 * is wrong" and sends them to check a key that is in fact correct; the real
 * problem is that this deployment has no keyring, which is ours to fix. It is
 * also why the API fails closed rather than open: a missing variable must
 * produce a loud error, never an unauthenticated catalogue.
 */
const UNCONFIGURED =
  'This API is not configured to accept requests. CATALOGUE_API_KEYS is unset on the server.'

const NO_KEY =
  'Provide an API key as `Authorization: Bearer <key>` or `x-api-key: <key>`.'

export async function withApi(
  request: Request,
  handler: (context: ApiContext) => Promise<Response>,
  options: Options = {},
): Promise<Response> {
  const auth: AuthOutcome = authorise(request, options.env ?? process.env)

  if (auth.status === 'unconfigured') return fail('unavailable', UNCONFIGURED)
  if (auth.status === 'rejected') return fail('unauthorized', NO_KEY)

  const limiter = options.limiter ?? catalogueLimiter
  const state = limiter.check(auth.keyId)
  const headers = rateLimitHeaders(state)

  if (!state.allowed) {
    return fail(
      'rate_limited',
      `Too many requests. This API allows ${state.limit} per minute. Try again shortly.`,
      { ...headers, ...retryAfter(state.resetAt) },
    )
  }

  const url = new URL(request.url)

  try {
    const response = await handler({
      keyId: auth.keyId,
      url,
      baseUrl: resolveBaseUrl(request),
    })

    // The remaining count rides on the success too, so a client can pace itself
    // rather than discovering the limit by being refused. A Response's headers
    // are still mutable at this point — nothing has read the body.
    for (const [name, value] of Object.entries(headers)) {
      response.headers.set(name, value)
    }

    return response
  } catch (error) {
    // A thrown error must not become a stack trace on somebody's screen, and
    // must not become a 200 with a half-built body either. It becomes the same
    // envelope every other failure uses.
    console.error('[api] Unhandled error in a catalogue route:', error)
    return fail('unavailable', 'Something went wrong reading the catalogue. Try again shortly.')
  }
}
