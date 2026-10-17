import { describe, expect, it } from 'vitest'

import { cursorFor, decodeCursor, encodeCursor, paginate } from './paging'

const rows = Array.from({ length: 30 }, (_, i) => `row-${i}`)

describe('cursor round trip', () => {
  it('reads back the offset it was given', () => {
    const decoded = decodeCursor(encodeCursor(25))
    expect(decoded).toEqual({ ok: true, offset: 25 })
  })

  it('is opaque to a reader who has not seen this module', () => {
    // Base64url of a JSON object — no digits a client could increment.
    expect(encodeCursor(25)).not.toContain('25')
  })
})

describe('decodeCursor', () => {
  it('refuses something that is not base64 JSON', () => {
    const decoded = decodeCursor('not-a-cursor')
    expect(decoded.ok).toBe(false)
  })

  it('refuses base64 that is not an object', () => {
    const encoded = Buffer.from('"hello"', 'utf8').toString('base64url')
    expect(decodeCursor(encoded).ok).toBe(false)
  })

  it('refuses a cursor from another version rather than misreading it', () => {
    const encoded = Buffer.from(JSON.stringify({ v: 99, o: 10 }), 'utf8').toString('base64url')
    const decoded = decodeCursor(encoded)

    expect(decoded.ok).toBe(false)
    if (!decoded.ok) expect(decoded.reason).toContain('different version')
  })

  it('refuses a non-integer or negative offset', () => {
    const make = (o: unknown) =>
      Buffer.from(JSON.stringify({ v: 1, o }), 'utf8').toString('base64url')

    expect(decodeCursor(make(-1)).ok).toBe(false)
    expect(decodeCursor(make(1.5)).ok).toBe(false)
    expect(decodeCursor(make('5')).ok).toBe(false)
    expect(decodeCursor(make(null)).ok).toBe(false)
  })
})

describe('paginate', () => {
  it('takes the first page and points at the next', () => {
    const result = paginate(rows, 0, 25)

    expect(result.page).toHaveLength(25)
    expect(result.page[0]).toBe('row-0')
    expect(result.total).toBe(30)
    expect(result.nextCursor).not.toBeNull()
  })

  it('walks from one cursor to the rest of the set', () => {
    const first = paginate(rows, 0, 25)
    const decoded = decodeCursor(first.nextCursor!)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    const second = paginate(rows, decoded.offset, 25)
    expect(second.page).toEqual(['row-25', 'row-26', 'row-27', 'row-28', 'row-29'])
  })

  // The signal to stop. A cursor for an empty page would make a client fetch
  // once more to learn what it already knows.
  it('returns no cursor when the page reached the end', () => {
    expect(paginate(rows, 25, 25).nextCursor).toBeNull()
  })

  it('returns no cursor when the limit exactly divides the set', () => {
    expect(paginate(rows, 0, 30).nextCursor).toBeNull()
  })

  it('returns an empty page, not an error, past the end', () => {
    const result = paginate(rows, 500, 25)
    expect(result.page).toEqual([])
    expect(result.nextCursor).toBeNull()
    expect(result.total).toBe(30)
  })

  it('reports the total across every page, not the page size', () => {
    expect(paginate(rows, 0, 5).total).toBe(30)
  })

  it('handles an empty catalogue', () => {
    expect(paginate([], 0, 25)).toEqual({ page: [], nextCursor: null, total: 0 })
  })
})

/**
 * The other way to reach a page. A SQL-paged reader hands back a page and a
 * `total` and never holds the rest of the set, so it cannot use `paginate` — and
 * both must agree about when a list has ended, or a client either fetches a page
 * for nothing or never learns there is another one.
 */
describe('cursorFor', () => {
  it('agrees with paginate on a set that has more to come', () => {
    expect(cursorFor(0, 25, 30)).toBe(paginate(rows, 0, 25).nextCursor)
  })

  it('agrees with paginate at the end of a set', () => {
    expect(cursorFor(25, 5, 30)).toBe(paginate(rows, 25, 25).nextCursor)
  })

  it('agrees with paginate when the page divides the set exactly', () => {
    expect(cursorFor(0, 30, 30)).toBe(paginate(rows, 0, 30).nextCursor)
  })

  // A filter can match fewer rows than the page asked for, which is the case a
  // reading of "returned < limit means this was the last page" gets wrong.
  it('points onward when a filter returned a short page but more rows remain', () => {
    expect(cursorFor(0, 3, 10)).not.toBeNull()
  })

  it('has no cursor for an empty catalogue', () => {
    expect(cursorFor(0, 0, 0)).toBeNull()
  })
})
