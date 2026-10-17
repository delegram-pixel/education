/**
 * The two response shapes, built in one place.
 *
 * Every success carries `{ data, pagination?, meta }` and every failure carries
 * `{ error }`. Nothing else is ever returned, so a client writes one unwrapper
 * and one error handler and is done — the alternative, a shape per endpoint,
 * makes every new endpoint a change to their code.
 *
 * Kept free of database and framework imports so it can be unit-tested directly;
 * `Response` is a runtime global in Node 18+ and in the edge runtime alike.
 */

import {
  API_VERSION,
  CATALOGUE_DISCLAIMER,
  ERROR_STATUS,
  type CatalogueSource,
  type ErrorCode,
} from './contract'

/**
 * How long a caller's own client may reuse a catalogue response.
 *
 * `private`, not `public` or `s-maxage`: these endpoints are key-gated, and a
 * shared cache keys on the URL alone — it never sees the `Authorization` header.
 * A `public` response would be stored by any intermediary and handed to the next
 * caller who asked for the same URL, key or no key, defeating the 401 in
 * `withApi` for as long as the entry lives. The body is public brochure data, so
 * the exposure is scraping and rate-limit evasion rather than private records,
 * but an authentication check that a cache can step around is still not a check.
 *
 * Five minutes, not the knowledge document's hour: this API answers questions a
 * student is waiting on rather than feeding a periodic upload, so a client
 * should stay within sight of the last sync. Errors are never cached at all — a
 * 401 or a 503 held anywhere is a bug that outlives its cause.
 */
const CACHE_CONTROL = 'private, max-age=300'
const NO_STORE = 'no-store'

/** What a list response says about the page it returned. */
export type PageInfo = {
  /** The page size actually applied, after clamping. */
  limit: number
  /** Opaque. Pass back as `cursor` for the next page; null on the last page. */
  nextCursor: string | null
  /**
   * How many rows matched, across every page.
   *
   * Present so a client can never mistake a truncated page for the whole set —
   * the failure the Markdown document already takes pains to avoid by saying how
   * many programmes it left out. `total` is what makes "12 of 3,412" sayable.
   */
  total: number
}

export type ResponseMeta = {
  source: CatalogueSource
  /** When this response was built — not when the catalogue was last crawled. */
  generatedAt: string
  apiVersion: string
  disclaimer: string
}

function meta(source: CatalogueSource): ResponseMeta {
  return {
    source,
    generatedAt: new Date().toISOString(),
    apiVersion: API_VERSION,
    disclaimer: CATALOGUE_DISCLAIMER,
  }
}

/**
 * A successful catalogue response.
 *
 * `pagination` is omitted rather than sent as null on an endpoint that has no
 * pages, so a client can test for its presence instead of for its contents.
 */
export function ok<T>(
  data: T,
  options: {
    source: CatalogueSource
    pagination?: PageInfo
    headers?: Record<string, string>
  },
): Response {
  const body = {
    data,
    ...(options.pagination ? { pagination: options.pagination } : {}),
    meta: meta(options.source),
  }

  return Response.json(body, {
    headers: { 'Cache-Control': CACHE_CONTROL, ...options.headers },
  })
}

/**
 * A failure.
 *
 * `message` is written for the developer integrating, not for a student: it says
 * what was wrong with the request, because the person reading it is holding the
 * spec. Anything a student should read belongs in the client's own copy, and the
 * status and code are what the client switches on.
 */
export function fail(
  code: ErrorCode,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { code, message } },
    {
      status: ERROR_STATUS[code],
      headers: { 'Cache-Control': NO_STORE, ...headers },
    },
  )
}

/**
 * The headers every response carries, so a client can pace itself.
 *
 * `Retry-After` is deliberately NOT among them: it belongs on a refusal, and a
 * `Retry-After` alongside a 200 tells a client to re-send a request that already
 * succeeded. The refusal adds it — see `retryAfter`.
 */
export function rateLimitHeaders(state: {
  limit: number
  remaining: number
  resetAt: number
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(state.limit),
    'X-RateLimit-Remaining': String(Math.max(0, state.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(state.resetAt / 1000)),
  }
}

/** Carried on a 429 only. Seconds, rounded up, never zero. */
export function retryAfter(resetAt: number): Record<string, string> {
  return { 'Retry-After': String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))) }
}
