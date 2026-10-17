import { describe, expect, it } from 'vitest'

import { dbConfigured } from '@/lib/db'
import { SAMPLE_INSTITUTION_DETAILS } from '@/lib/db/catalogue.data'
import { subjectName } from '@/lib/types'

import { listProgrammes } from './catalogue'

/**
 * The filters on the no-database path.
 *
 * `readProgrammes` narrows in SQL when there is a database and through
 * `sampleMatches` when there is not, and the second is the path a deployment
 * with no `DATABASE_URL` actually serves — the app is built to work without one.
 * A filter that works in SQL and is ignored in memory would not fail; it would
 * answer a question about Lagos with the national sample, which is a wrong
 * answer rather than a degraded one. So the in-memory side is pinned here.
 *
 * Every expectation is recomputed from the sample rows rather than written down,
 * because the sample is data and a hardcoded count would start failing the next
 * time a course is added — testing the fixture rather than the filter.
 *
 * Skipped when a database is configured, since the reader would then take the
 * SQL path and these assertions would be about a query this file cannot see.
 */
describe.skipIf(dbConfigured)('the catalogue reader without a database', () => {
  /** Case-insensitive "contains", as the in-memory filter applies it. */
  const mentions = (haystack: string, needle: string) =>
    haystack.toLowerCase().includes(needle.toLowerCase())

  it('reports a total for the whole match set, not for the page it returned', async () => {
    const all = await listProgrammes({})
    const firstPage = await listProgrammes({ limit: 2 })

    expect(all.programmes.length).toBeGreaterThan(0)
    expect(firstPage.programmes.length).toBeLessThanOrEqual(2)
    expect(firstPage.total).toBe(all.programmes.length)
  })

  it('pages without repeating or dropping a row', async () => {
    const first = await listProgrammes({ limit: 2, offset: 0 })
    const second = await listProgrammes({ limit: 2, offset: 2 })

    const firstKeys = first.programmes.map((row) => `${row.institution}|${row.programme}`)
    const secondKeys = second.programmes.map((row) => `${row.institution}|${row.programme}`)

    expect(firstKeys.some((key) => secondKeys.includes(key))).toBe(false)
    expect(second.total).toBe(first.total)
  })

  it('keeps a state filter to an exact, case-insensitive match', async () => {
    const all = await listProgrammes({})
    const lagos = await listProgrammes({ state: 'Lagos' })
    const lowercase = await listProgrammes({ state: 'lagos' })

    const expected = all.programmes.filter(
      (row) => (SAMPLE_INSTITUTION_DETAILS[row.institution]?.state ?? '').toLowerCase() === 'lagos',
    ).length

    expect(lagos.total).toBe(expected)
    // A client reading the docs rather than the facets should not get nothing.
    expect(lowercase.total).toBe(lagos.total)
  })

  // The case the two paths could disagree about. `%` is a filter built from an
  // empty form field — a real thing for a client to send — and unescaped it is a
  // `LIKE` pattern matching every row in the catalogue, where the in-memory path
  // matches none. Asserted against the unfiltered total so the test cannot pass
  // by there being nothing to match.
  it('does not read a wildcard in a filter as an instruction', async () => {
    const all = await listProgrammes({})
    const wildcard = await listProgrammes({ q: '%' })

    expect(all.total).toBeGreaterThan(0)
    expect(wildcard.total).toBe(0)
    expect(wildcard.total).toBeLessThan(all.total)

    // `_` is `LIKE`'s single-character wildcard, so unescaped this would select
    // every state with at least one letter in it.
    expect((await listProgrammes({ state: '_' })).total).toBe(0)
  })

  it('leaves out a school whose state the catalogue does not record', async () => {
    const unplaceable = await listProgrammes({ state: 'Lagos' })

    for (const row of unplaceable.programmes) {
      expect(SAMPLE_INSTITUTION_DETAILS[row.institution]?.state).toBeTruthy()
    }
  })

  it('searches the programme name and the institution name alike', async () => {
    const all = await listProgrammes({})
    const term = all.programmes[0]!.programme.split(' ')[0]!

    const found = await listProgrammes({ q: term })
    const expected = all.programmes.filter((row) =>
      mentions(`${row.programme} ${row.institution}`, term),
    )

    expect(found.total).toBe(expected.length)
    expect(found.total).toBeGreaterThan(0)
  })

  it('matches a subject by the name the brochure publishes, not the code', async () => {
    const all = await listProgrammes({})
    const english = subjectName('ENG')

    const found = await listProgrammes({ subject: 'ENG' })
    const expected = all.programmes.filter((row) =>
      row.utmeSubjects.some((label) => mentions(label, english)),
    )

    expect(found.total).toBe(expected.length)
  })

  it('says the answer came from the sample, since there was no mirror to ask', async () => {
    const result = await listProgrammes({ state: 'Lagos' })

    expect(result.source).toBe('sample')
  })
})
