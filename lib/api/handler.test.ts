import { afterEach, describe, expect, it, vi } from 'vitest'

import { withApi, type ApiContext } from './handler'
import { createRateLimiter } from './rate-limit'

const ENV = { CATALOGUE_API_KEYS: 'first-key, second-key' }

/** A free limiter per test, so one test's spending cannot refuse the next. */
function limiter(requests = 60) {
  return createRateLimiter({ requests, windowMs: 60_000 })
}

function get(path = 'https://app.example/api/v1/meta', headers: Record<string, string> = {}) {
  return new Request(path, { headers })
}

// `env` is annotated rather than inferred from the default: without it, TS
// narrows the parameter to `typeof ENV`, and the tests that pass `{}` to mean
// "no keyring" are rejected for missing a key they are deliberately omitting.
function ok(
  handler: (context: ApiContext) => Promise<Response>,
  env: Record<string, string | undefined> = ENV,
  requests = 60,
) {
  return withApi(get('https://app.example/api/v1/meta', { Authorization: 'Bearer first-key' }), handler, {
    env,
    limiter: limiter(requests),
  })
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

/** A handler that must not run; if it does, the test says so. */
const never = vi.fn(async () => new Response('{}'))

afterEach(() => {
  never.mockClear()
})

describe('withApi — configuration', () => {
  // A missing keyring is our mistake, not the caller's, and a 401 would send
  // them to check a key that is in fact correct.
  it('answers 503 when no keyring is configured, and does not call the handler', async () => {
    const response = await ok(never, {})

    expect(response.status).toBe(503)
    expect((await readBody(response)).error).toMatchObject({ code: 'unavailable' })
    expect(never).not.toHaveBeenCalled()
  })

  it('treats a keyring of blanks and commas as unconfigured, not as an empty allow-list', async () => {
    const response = await ok(never, { CATALOGUE_API_KEYS: ' , , ' })
    expect(response.status).toBe(503)
  })

  // Fails closed: nothing configured must never mean "let everyone in".
  it('never serves the catalogue without a keyring', async () => {
    const response = await ok(never, { CATALOGUE_API_KEYS: '' })
    expect(response.status).not.toBe(200)
  })
})

describe('withApi — authentication', () => {
  it('answers 401 when no key is presented', async () => {
    const response = await withApi(get(), never, { env: ENV, limiter: limiter() })

    expect(response.status).toBe(401)
    expect((await readBody(response)).error).toMatchObject({ code: 'unauthorized' })
    expect(never).not.toHaveBeenCalled()
  })

  it('answers 401 for a key that is not ours', async () => {
    const response = await withApi(get(undefined, { Authorization: 'Bearer not-a-key' }), never, {
      env: ENV,
      limiter: limiter(),
    })

    expect(response.status).toBe(401)
    expect(never).not.toHaveBeenCalled()
  })

  it('accepts any key in the ring, so a rotation needs no code change', async () => {
    const response = await withApi(get(undefined, { 'x-api-key': 'second-key' }), async () => new Response('{"data":[]}'), {
      env: ENV,
      limiter: limiter(),
    })

    expect(response.status).toBe(200)
  })

  // The reason to authenticate before limiting: the bucket is keyed on an
  // identity, and an unauthorised request has none.
  it('does not spend the rate limit on a rejected request', async () => {
    const shared = limiter(1)

    await withApi(get(undefined, { Authorization: 'Bearer wrong' }), never, { env: ENV, limiter: shared })
    await withApi(get(undefined, { Authorization: 'Bearer wrong' }), never, { env: ENV, limiter: shared })

    const response = await withApi(get(undefined, { Authorization: 'Bearer first-key' }), async () => new Response('{"data":[]}'), {
      env: ENV,
      limiter: shared,
    })

    expect(response.status).toBe(200)
  })

  it('hands the handler a key id, never the key', async () => {
    let seen: ApiContext | null = null

    await withApi(get(undefined, { Authorization: 'Bearer first-key' }), async (context) => {
      seen = context
      return new Response('{"data":[]}')
    }, { env: ENV, limiter: limiter() })

    expect(seen!.keyId).toMatch(/^[0-9a-f]{12}$/)
    expect(JSON.stringify(seen)).not.toContain('first-key')
  })

  // Two keys must not share a bucket, or one integrator could spend another's.
  it('gives two keys separate buckets', async () => {
    const shared = limiter(1)
    const call = (key: string) =>
      withApi(get(undefined, { Authorization: `Bearer ${key}` }), async () => new Response('{"data":[]}'), {
        env: ENV,
        limiter: shared,
      })

    expect((await call('first-key')).status).toBe(200)
    expect((await call('second-key')).status).toBe(200)
    expect((await call('first-key')).status).toBe(429)
  })
})

describe('withApi — rate limiting', () => {
  it('allows up to the ceiling and refuses the one past it', async () => {
    const shared = limiter(2)
    const call = () =>
      withApi(get(undefined, { Authorization: 'Bearer first-key' }), async () => new Response('{"data":[]}'), {
        env: ENV,
        limiter: shared,
      })

    expect((await call()).status).toBe(200)
    expect((await call()).status).toBe(200)
    expect((await call()).status).toBe(429)
  })

  it('tells a refused client when to come back', async () => {
    const shared = limiter(1)
    await withApi(get(undefined, { Authorization: 'Bearer first-key' }), async () => new Response('{}'), {
      env: ENV,
      limiter: shared,
    })
    const response = await withApi(get(undefined, { Authorization: 'Bearer first-key' }), never, {
      env: ENV,
      limiter: shared,
    })

    expect(response.headers.get('Retry-After')).toBeTruthy()
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(never).not.toHaveBeenCalled()
  })

  it('never caches a refusal', async () => {
    const shared = limiter(0)
    const response = await withApi(get(undefined, { Authorization: 'Bearer first-key' }), never, {
      env: ENV,
      limiter: shared,
    })

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('withApi — headers on success', () => {
  it('reports the remaining count on the success too, so a client need not be refused to learn it', async () => {
    const response = await ok(async () => new Response('{"data":[]}'))

    expect(response.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('59')
    // Only a refusal carries it; see `respond.retryAfter`.
    expect(response.headers.get('Retry-After')).toBeNull()
  })

  it('stamps the headers onto the handler response without disturbing its body', async () => {
    const response = await ok(async () => new Response(JSON.stringify({ data: [{ id: 'unilag' }] }), {
      headers: { 'Content-Type': 'application/json' },
    }))

    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await readBody(response)).toEqual({ data: [{ id: 'unilag' }] })
  })
})

describe('withApi — a handler that throws', () => {
  it('answers with the documented envelope rather than a stack trace', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await ok(async () => {
      throw new Error('connection terminated unexpectedly')
    })

    const payload = await readBody(response)
    expect(response.status).toBe(503)
    expect(payload.error).toMatchObject({ code: 'unavailable' })
    expect(JSON.stringify(payload)).not.toContain('connection terminated')

    spy.mockRestore()
  })

  it('logs the failure server-side, where it is useful', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await ok(async () => {
      throw new Error('database is down')
    })

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // A thrown error after a partial write of headers cannot be repaired, so the
  // only safe answer is a fresh response.
  it('never caches a failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await ok(async () => {
      throw new Error('boom')
    })

    expect(response.headers.get('Cache-Control')).toBe('no-store')
    spy.mockRestore()
  })
})

describe('withApi — the context it builds', () => {
  it('parses the URL once, so a handler reads query params without re-parsing', async () => {
    let seen: ApiContext | null = null

    await withApi(
      get('https://app.example/api/v1/programmes?state=Lagos&limit=10', {
        Authorization: 'Bearer first-key',
      }),
      async (context) => {
        seen = context
        return new Response('{"data":[]}')
      },
      { env: ENV, limiter: limiter() },
    )

    expect(seen!.url.searchParams.get('state')).toBe('Lagos')
    expect(seen!.url.searchParams.get('limit')).toBe('10')
  })

  it('falls back to the request origin, so a preview deployment needs no configuration', async () => {
    let seen: ApiContext | null = null

    await withApi(
      get('https://preview-abc.vercel.app/api/v1/meta', { Authorization: 'Bearer first-key' }),
      async (context) => {
        seen = context
        return new Response('{"data":[]}')
      },
      { env: ENV, limiter: limiter() },
    )

    expect(seen!.baseUrl).toBe('https://preview-abc.vercel.app')
  })

  it('prefers a configured app address over the caller-supplied host', async () => {
    const configured = process.env.APP_BASE_URL
    process.env.APP_BASE_URL = 'https://admissioncopilot.ng/'
    let seen: ApiContext | null = null

    try {
      await withApi(
        get('https://spoofed.example/api/v1/meta', { Authorization: 'Bearer first-key' }),
        async (context) => {
          seen = context
          return new Response('{"data":[]}')
        },
        { env: ENV, limiter: limiter() },
      )
    } finally {
      if (configured === undefined) delete process.env.APP_BASE_URL
      else process.env.APP_BASE_URL = configured
    }

    expect(seen!.baseUrl).toBe('https://admissioncopilot.ng')
  })
})
