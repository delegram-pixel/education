import { describe, expect, it } from 'vitest'

import { createRateLimiter } from './rate-limit'

/** A clock the test moves by hand, so no test waits on a real window. */
function clock(start = 1_000_000) {
  let at = start
  return {
    now: () => at,
    advance: (ms: number) => {
      at += ms
    },
  }
}

const limiter = (requests: number, time: ReturnType<typeof clock>, windowMs = 60_000) =>
  createRateLimiter({ requests, windowMs, now: time.now })

describe('within a window', () => {
  it('allows requests up to the ceiling', () => {
    const time = clock()
    const limit = limiter(3, time)

    expect(limit.check('a').allowed).toBe(true)
    expect(limit.check('a').allowed).toBe(true)
    expect(limit.check('a').allowed).toBe(true)
  })

  it('refuses the one past the ceiling', () => {
    const time = clock()
    const limit = limiter(3, time)

    limit.check('a')
    limit.check('a')
    limit.check('a')

    const fourth = limit.check('a')
    expect(fourth.allowed).toBe(false)
    expect(fourth.remaining).toBe(-1)
  })

  it('counts each key separately, so one caller cannot spend another quota', () => {
    const time = clock()
    const limit = limiter(1, time)

    expect(limit.check('a').allowed).toBe(true)
    expect(limit.check('a').allowed).toBe(false)
    expect(limit.check('b').allowed).toBe(true)
  })

  it('reports the ceiling and when the window ends', () => {
    const time = clock()
    const state = limiter(10, time, 30_000).check('a')

    expect(state.limit).toBe(10)
    expect(state.resetAt).toBe(time.now() + 30_000)
  })
})

describe('across windows', () => {
  it('starts again once the window has passed', () => {
    const time = clock()
    const limit = limiter(1, time)

    expect(limit.check('a').allowed).toBe(true)
    expect(limit.check('a').allowed).toBe(false)

    time.advance(60_001)

    expect(limit.check('a').allowed).toBe(true)
  })

  it('keeps the window open right up to its edge', () => {
    const time = clock()
    const limit = limiter(1, time)

    limit.check('a')
    time.advance(59_999)

    expect(limit.check('a').allowed).toBe(false)
  })
})

describe('the bucket map', () => {
  it('sweeps expired buckets once it reaches its ceiling', () => {
    const time = clock()
    const limit = createRateLimiter({
      requests: 5,
      windowMs: 1_000,
      now: time.now,
      maxBuckets: 4,
    })

    // Four distinct callers fill the map; time then passes, expiring all of them.
    for (const id of ['a', 'b', 'c', 'd']) limit.check(id)
    time.advance(1_001)

    // The fifth caller triggers the sweep rather than growing the map forever.
    expect(limit.check('e').allowed).toBe(true)
  })

  it('does not lose a live bucket to the sweep', () => {
    const time = clock()
    const limit = createRateLimiter({
      requests: 1,
      windowMs: 60_000,
      now: time.now,
      maxBuckets: 2,
    })

    limit.check('live')
    limit.check('filler-1')
    limit.check('filler-2')

    // `live` is still inside its window, so its count must survive.
    expect(limit.check('live').allowed).toBe(false)
  })
})
