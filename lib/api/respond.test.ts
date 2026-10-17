import { describe, expect, it } from 'vitest'

import { ERROR_CODES, ERROR_STATUS } from './contract'
import { fail, ok, rateLimitHeaders, retryAfter } from './respond'

/** Reading a Response body is async; this keeps the tests flat. */
async function readBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

describe('ok', () => {
  it('wraps data with the meta every catalogue response carries', async () => {
    const response = ok([{ id: '1' }], { source: 'ibass' })
    const payload = await readBody(response)

    expect(payload.data).toEqual([{ id: '1' }])
    expect(payload.meta).toMatchObject({ source: 'ibass', apiVersion: '1' })
    expect(String((payload.meta as Record<string, unknown>).disclaimer)).toContain('not an offer')
  })

  it('omits pagination rather than sending null on an unpaged endpoint', async () => {
    const payload = await readBody(ok({}, { source: 'ibass' }))
    expect('pagination' in payload).toBe(false)
  })

  it('carries pagination when there is a page', async () => {
    const response = ok([], {
      source: 'ibass',
      pagination: { limit: 25, nextCursor: null, total: 0 },
    })

    expect((await readBody(response)).pagination).toEqual({
      limit: 25,
      nextCursor: null,
      total: 0,
    })
  })

  // A shared cache keys on the URL and never sees the Authorization header, so
  // `public` here would let it hand a cached body to a caller who presented no
  // key — stepping around the 401 that `withApi` exists to return.
  it('is cacheable by the caller, but never by a shared cache', () => {
    const cacheControl = ok([], { source: 'ibass' }).headers.get('Cache-Control')!

    expect(cacheControl).toContain('private')
    expect(cacheControl).not.toContain('public')
    expect(cacheControl).not.toContain('s-maxage')
  })

  it('reports a degraded catalogue as the source, not as an error', async () => {
    const payload = await readBody(ok([], { source: 'sample' }))
    expect((payload.meta as Record<string, unknown>).source).toBe('sample')
  })
})

describe('fail', () => {
  it('returns the documented status for every code', () => {
    for (const code of ERROR_CODES) {
      expect(fail(code, 'x').status).toBe(ERROR_STATUS[code])
    }
  })

  // One shape for every failure, so a client writes one error handler.
  it('uses one body shape for every code', async () => {
    for (const code of ERROR_CODES) {
      const payload = await readBody(fail(code, 'something specific'))
      expect(payload).toEqual({ error: { code, message: 'something specific' } })
    }
  })

  // A 401 held at the edge is a bug that outlives its cause.
  it('is never cached', () => {
    for (const code of ERROR_CODES) {
      expect(fail(code, 'x').headers.get('Cache-Control')).toBe('no-store')
    }
  })

  it('keeps headers it is handed, so a 429 can carry Retry-After', () => {
    const response = fail('rate_limited', 'slow down', { 'Retry-After': '30' })

    expect(response.headers.get('Retry-After')).toBe('30')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('rateLimitHeaders', () => {
  it('says what the ceiling is and how much is left', () => {
    const headers = rateLimitHeaders({
      limit: 60,
      remaining: 58,
      resetAt: Date.now() + 30_000,
    })

    expect(headers['X-RateLimit-Limit']).toBe('60')
    expect(headers['X-RateLimit-Remaining']).toBe('58')
    expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(0)
  })

  it('never reports a negative remaining count', () => {
    const headers = rateLimitHeaders({ limit: 60, remaining: -5, resetAt: Date.now() })
    expect(headers['X-RateLimit-Remaining']).toBe('0')
  })

  // These ride on successes too. A Retry-After beside a 200 tells a client to
  // re-send a request that already succeeded, so it is not one of them.
  it('carries no Retry-After, because it is sent on successes', () => {
    expect(rateLimitHeaders({ limit: 60, remaining: 1, resetAt: Date.now() + 30_000 }))
      .not.toHaveProperty('Retry-After')
  })
})

describe('retryAfter', () => {
  it('counts the seconds to the end of the window', () => {
    expect(Number(retryAfter(Date.now() + 30_000)['Retry-After'])).toBeGreaterThan(0)
    expect(Number(retryAfter(Date.now() + 30_000)['Retry-After'])).toBeLessThanOrEqual(30)
  })

  it('never asks a client to wait zero seconds', () => {
    expect(retryAfter(Date.now() - 5_000)['Retry-After']).toBe('1')
  })
})
