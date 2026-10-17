import { describe, expect, it } from 'vitest'

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './contract'
import { encodeCursor } from './paging'
import { parseListParams } from './params'

const parse = (query: string) => parseListParams(new URLSearchParams(query))

function value(query: string) {
  const result = parse(query)
  if (!result.ok) throw new Error(`expected a parsed result, got: ${result.message}`)
  return result.value
}

describe('page size', () => {
  it('defaults when the client asks for nothing', () => {
    expect(value('').limit).toBe(DEFAULT_PAGE_SIZE)
  })

  // Clamped, not refused: `limit=1000` is a reasonable request for more than we
  // serve, and an error would be less useful than the most we will give.
  it('clamps a request above the maximum', () => {
    expect(value(`limit=1000`).limit).toBe(MAX_PAGE_SIZE)
  })

  it('clamps a request below one rather than serving an empty page', () => {
    expect(value('limit=0').limit).toBe(1)
  })

  // Refused, not clamped: this is a bug in the client, and answering it with 25
  // would leave them wondering why paging never ends.
  it('refuses a limit that is not a number', () => {
    const result = parse('limit=lots')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('whole number')
  })

  it('refuses a negative limit', () => {
    expect(parse('limit=-5').ok).toBe(false)
  })
})

describe('cursor', () => {
  it('starts at the beginning when none is given', () => {
    expect(value('').offset).toBe(0)
  })

  it('reads back an offset it issued', () => {
    expect(value(`cursor=${encodeCursor(50)}`).offset).toBe(50)
  })

  it("refuses a cursor it did not issue, with the decoder's own reason", () => {
    const result = parse('cursor=rubbish')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('not a cursor')
  })

  it('refuses a cursor rather than silently restarting at page one', () => {
    // The failure this guards against: a client treating an unreadable cursor as
    // "start again" sees an infinite list instead of their own bug.
    expect(parse('cursor=rubbish').ok).toBe(false)
  })
})

describe('filters', () => {
  it('reads the filters it was given', () => {
    const params = value('state=Lagos&type=Federal&category=University&q=nursing')
    expect(params).toMatchObject({
      state: 'Lagos',
      type: 'Federal',
      category: 'University',
      q: 'nursing',
    })
  })

  it('trims whitespace rather than matching on it', () => {
    expect(value('state=%20Lagos%20').state).toBe('Lagos')
  })

  // `?state=` is a client building a query string from an empty form field. It
  // means "no filter", not "institutions whose state is the empty string".
  it('treats a blank filter as absent', () => {
    expect(value('state=&q=&type=').state).toBeUndefined()
    expect(value('state=&q=').q).toBe('')
  })

  it('leaves the filters an endpoint does not accept undefined', () => {
    const params = value('limit=5')
    expect(params.institutionId).toBeUndefined()
    expect(params.subject).toBeUndefined()
  })
})

describe('subject', () => {
  it('reads a code the catalogue publishes', () => {
    expect(value('subject=BIO').subject).toBe('BIO')
  })

  // The client read the docs and not the vocabulary. Answering with an empty list
  // would look to them like a catalogue with no Biology in it.
  it('accepts a code in any case, since a code is not a name', () => {
    expect(value('subject=bio').subject).toBe('BIO')
  })

  it('refuses a subject name, and says where the codes are', () => {
    const result = parse('subject=Biology')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Biology')
      expect(result.message).toContain('/subjects')
    }
  })

  it('refuses a code this catalogue does not use', () => {
    expect(parse('subject=XYZ').ok).toBe(false)
  })

  it('treats a blank subject as no filter rather than as a bad one', () => {
    expect(value('subject=').subject).toBeUndefined()
  })
})
