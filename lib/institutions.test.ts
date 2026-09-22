import { describe, expect, it } from 'vitest'

import type { CatalogueInstitution } from '@/lib/db/catalogue'
import {
  coursesForInstitution,
  filterInstitutions,
  groupByState,
  hasActiveFilters,
  institutionFacets,
  isReviewedInstitution,
  NO_FILTERS,
  reviewedInstitutionKeys,
  searchInstitutions,
  suggestInstitutions,
  UNRECORDED_STATE,
  withReviewedInstitutions,
  type CatalogueProgrammeRow,
  type FacetOption,
  type ReviewedCourse,
} from '@/lib/institutions'

function institution(
  overrides: Partial<CatalogueInstitution> & { name: string },
): CatalogueInstitution {
  return {
    id: overrides.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    institutionType: 'University',
    category: 'Federal',
    state: 'Lagos',
    programmeCount: 1,
    sourceUrl: 'https://ibass.jamb.gov.ng/brochure-by-institution',
    sourceUpdatedAt: new Date(0),
    ...overrides,
  }
}

/** The count a facet offers for one option, or undefined when it offers none. */
function countFor(options: FacetOption[], value: string): number | undefined {
  return options.find((option) => option.value === value)?.count
}

describe('groupByState', () => {
  it('treats an empty state and a missing one as the same group', () => {
    const groups = groupByState([
      institution({ name: 'Alpha', state: '' }),
      institution({ name: 'Beta', state: null }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.state).toBeNull()
    expect(groups[0]?.institutions).toHaveLength(2)
  })

  it('places the unrecorded group last', () => {
    const groups = groupByState([
      institution({ name: 'Alpha', state: null }),
      institution({ name: 'Beta', state: 'Abia' }),
    ])

    expect(groups.map((group) => group.state)).toEqual(['Abia', null])
  })
})

describe('searchInstitutions', () => {
  const rows = [
    institution({ name: 'University of Lagos', state: 'Lagos' }),
    institution({ name: 'University of Ibadan', state: 'Oyo' }),
  ]

  it('returns the list untouched for an empty query', () => {
    expect(searchInstitutions(rows, '  ')).toBe(rows)
  })

  it('matches a name without regard to case', () => {
    expect(searchInstitutions(rows, 'ibadan').map((row) => row.name)).toEqual([
      'University of Ibadan',
    ])
  })

  // IBASS writes names the way institutions write them; students type the way
  // people type. A raw substring match loses schools both ways, and a school
  // that cannot be found looks exactly like a school that is not there.
  it('finds a hyphenated name typed with a space', () => {
    const rows = [institution({ name: 'UNIVERSITY OF PORT-HARCOURT, RIVERS STATE' })]

    expect(searchInstitutions(rows, 'university of port harcourt')).toHaveLength(1)
  })

  it('finds a name typed with the punctuation it was written with', () => {
    const rows = [institution({ name: 'UNIVERSITY OF PORT HARCOURT, RIVERS STATE' })]

    expect(searchInstitutions(rows, 'port-harcourt')).toHaveLength(1)
  })

  it('finds a name with doubled spaces typed with one', () => {
    const rows = [institution({ name: 'USMANU  DANFODIYO UNIVERSITY, SOKOTO, SOKOTO STATE' })]

    expect(searchInstitutions(rows, 'usmanu danfodiyo')).toHaveLength(1)
  })

  it('still matches on the state', () => {
    const rows = [institution({ name: 'Alpha', state: 'Oyo' })]

    expect(searchInstitutions(rows, 'oyo')).toHaveLength(1)
  })
})

describe('suggestInstitutions ranking', () => {
  const reviewedKeys = new Set<string>()

  function names(rows: CatalogueInstitution[], query: string): string[] {
    const result = suggestInstitutions(rows, { ...NO_FILTERS, query }, reviewedKeys)
    return [...result.reviewed, ...result.listings].map((entry) => entry.institution.name)
  }

  // The regression that prompted these: the university a student named in full
  // sat behind institutions that merely mention it, because the mirror held
  // programme counts for those and none yet for the university.
  it('puts the school named in full above one that merely mentions it', () => {
    const rows = [
      institution({
        name: 'DON BOSCO INSTITUTE OF PHILOSOPHY (AFFILIATED TO UNIVERSITY OF IBADAN)',
        programmeCount: 90,
      }),
      institution({ name: 'UNIVERSITY OF IBADAN, IBADAN, OYO STATE', programmeCount: 0 }),
    ]

    expect(names(rows, 'university of ibadan')[0]).toBe('UNIVERSITY OF IBADAN, IBADAN, OYO STATE')
  })

  it('puts a name that opens with the query above one that only contains it', () => {
    const rows = [
      institution({ name: 'UNIVERSITY OF LAGOS, LAGOS STATE', programmeCount: 90 }),
      institution({ name: 'LAGOS STATE UNIVERSITY, OJO', programmeCount: 5 }),
    ]

    expect(names(rows, 'lagos')[0]).toBe('LAGOS STATE UNIVERSITY, OJO')
  })

  it('falls back to the fuller record within one rank', () => {
    const rows = [
      institution({ name: 'Alpha University', programmeCount: 4 }),
      institution({ name: 'Alpha Polytechnic', programmeCount: 90 }),
    ]

    expect(names(rows, 'alpha')).toEqual(['Alpha Polytechnic', 'Alpha University'])
  })

  it('leads with the fullest records while nothing has been typed', () => {
    const rows = [
      institution({ name: 'Alpha University', programmeCount: 4 }),
      institution({ name: 'Zeta Polytechnic', programmeCount: 90 }),
    ]

    expect(names(rows, '')).toEqual(['Zeta Polytechnic', 'Alpha University'])
  })
})

describe('filterInstitutions', () => {
  const rows = [
    institution({ name: 'University of Lagos', state: 'Lagos', institutionType: 'University' }),
    institution({
      name: 'Yaba College of Technology',
      state: 'Lagos',
      institutionType: 'Polytechnic',
    }),
    institution({ name: 'University of Ibadan', state: 'Oyo', institutionType: 'University' }),
  ]

  it('returns the list untouched when nothing is set', () => {
    expect(filterInstitutions(rows, NO_FILTERS)).toBe(rows)
  })

  it('narrows to one state', () => {
    expect(filterInstitutions(rows, { ...NO_FILTERS, state: 'Lagos' }).map((row) => row.name)).toEqual(
      ['University of Lagos', 'Yaba College of Technology'],
    )
  })

  it('combines a state with a type', () => {
    const narrowed = filterInstitutions(rows, { ...NO_FILTERS, state: 'Lagos', type: 'Polytechnic' })

    expect(narrowed.map((row) => row.name)).toEqual(['Yaba College of Technology'])
  })

  it('reaches the schools the catalogue records no state for', () => {
    const withUnrecorded = [...rows, institution({ name: 'No State Recorded', state: null })]
    const narrowed = filterInstitutions(withUnrecorded, { ...NO_FILTERS, state: UNRECORDED_STATE })

    expect(narrowed.map((row) => row.name)).toEqual(['No State Recorded'])
  })
})

describe('institutionFacets', () => {
  const rows = [
    institution({ name: 'Alpha', state: 'Lagos', institutionType: 'University' }),
    institution({ name: 'Beta', state: 'Lagos', institutionType: 'Polytechnic' }),
    institution({ name: 'Gamma', state: 'Oyo', institutionType: 'University' }),
  ]

  it('counts a dimension against the other filters, not its own', () => {
    expect(countFor(institutionFacets(rows, NO_FILTERS).state, 'Lagos')).toBe(2)

    // Narrowed to universities, the Lagos option must promise one — because one
    // is what selecting it now shows.
    const narrowed = institutionFacets(rows, { ...NO_FILTERS, type: 'University' })
    expect(countFor(narrowed.state, 'Lagos')).toBe(1)
    expect(countFor(narrowed.state, 'Oyo')).toBe(1)
  })

  it('still offers every type while one of them is chosen', () => {
    const narrowed = institutionFacets(rows, { ...NO_FILTERS, type: 'Polytechnic' })
    expect(narrowed.type.map((option) => option.value)).toContain('University')
  })

  it('offers no options for a dimension no row records', () => {
    expect(institutionFacets([institution({ name: 'Alpha', category: null })], NO_FILTERS).category).toEqual([])
  })

  it('sorts states alphabetically with the unrecorded bucket last', () => {
    const rows = [
      institution({ name: 'Alpha', state: 'Oyo' }),
      institution({ name: 'Beta', state: null }),
      institution({ name: 'Gamma', state: 'Abia' }),
    ]

    expect(institutionFacets(rows, NO_FILTERS).state.map((option) => option.value)).toEqual([
      'Abia',
      'Oyo',
      UNRECORDED_STATE,
    ])
  })
})

describe('hasActiveFilters', () => {
  it('is false for a query that is only whitespace', () => {
    expect(hasActiveFilters({ ...NO_FILTERS, query: '   ' })).toBe(false)
  })

  it('is true once a dimension is chosen', () => {
    expect(hasActiveFilters({ ...NO_FILTERS, state: 'Lagos' })).toBe(true)
  })
})

describe('reviewedInstitutionKeys', () => {
  // The key has to agree with the programme-level match in `readProgrammes`, so
  // it normalises the same way `nameKey` does: case, punctuation and the
  // ampersand all have to fold, or a school the checker can decide on shows up
  // as unverified purely because the two sources spelled it differently.
  it('folds the spellings a catalogue and a course list disagree on', () => {
    const keys = reviewedInstitutionKeys([{ institution: 'University of Lagos' }])

    expect(keys.has('university of lagos')).toBe(true)
    expect(
      isReviewedInstitution(institution({ name: 'UNIVERSITY  OF  LAGOS' }), keys),
    ).toBe(true)
  })

  it('does not mark a school the checker has no course at', () => {
    const keys = reviewedInstitutionKeys([{ institution: 'University of Lagos' }])

    expect(isReviewedInstitution(institution({ name: 'University of Ibadan' }), keys)).toBe(false)
  })
})

describe('suggestInstitutions', () => {
  const reviewedKeys = reviewedInstitutionKeys([{ institution: 'University of Lagos' }])
  const rows = [
    institution({ name: 'University of Lagos', programmeCount: 3 }),
    institution({ name: 'Yaba College of Technology', programmeCount: 90 }),
    institution({ name: 'University of Ibadan', programmeCount: 40 }),
  ]

  it('offers the reviewed schools first, whatever their programme count', () => {
    const suggestions = suggestInstitutions(rows, NO_FILTERS, reviewedKeys)

    expect(suggestions.reviewed.map((entry) => entry.institution.name)).toEqual([
      'University of Lagos',
    ])
    expect(suggestions.listings.map((entry) => entry.institution.name)).toEqual([
      'Yaba College of Technology',
      'University of Ibadan',
    ])
  })

  it('reports every match, not just the ones it renders', () => {
    const suggestions = suggestInstitutions(rows, NO_FILTERS, reviewedKeys, 1)

    expect(suggestions.total).toBe(3)
    expect(suggestions.reviewed).toHaveLength(1)
    expect(suggestions.listings).toHaveLength(0)
  })

  it('never lets the cap crowd out a reviewed school', () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      institution({ name: `Catalogue School ${index}`, programmeCount: 100 - index }),
    )
    const suggestions = suggestInstitutions([...many, ...rows], NO_FILTERS, reviewedKeys, 40)

    expect(suggestions.reviewed).toHaveLength(1)
    expect(suggestions.listings).toHaveLength(39)
    expect(suggestions.total).toBe(63)
  })

  it('narrows by the same filters the list does', () => {
    const suggestions = suggestInstitutions(
      rows,
      { ...NO_FILTERS, query: 'ibadan' },
      reviewedKeys,
    )

    expect(suggestions.total).toBe(1)
    expect(suggestions.listings[0]?.institution.name).toBe('University of Ibadan')
  })
})

function course(
  overrides: Partial<ReviewedCourse> & { id: string; name: string; institution: string },
): ReviewedCourse {
  return { institutionShort: 'UNILAG', faculty: 'Faculty of Science', ...overrides }
}

function programme(
  overrides: Partial<CatalogueProgrammeRow> & { programme: string },
): CatalogueProgrammeRow {
  return {
    department: null,
    utmeSubjects: [],
    sourceUrl: 'https://ibass.jamb.gov.ng/brochure-by-institution',
    reviewedCourseId: null,
    ...overrides,
  }
}

describe('withReviewedInstitutions', () => {
  const unilag = course({ id: 'medicine-unilag', name: 'Medicine & Surgery', institution: 'University of Lagos' })

  it('leaves the catalogue untouched when every reviewed school is already in it', () => {
    const rows = [institution({ name: 'University of Lagos' })]

    expect(withReviewedInstitutions(rows, [unilag])).toBe(rows)
  })

  it('adds a reviewed school the catalogue does not carry', () => {
    const rows = [institution({ name: 'Yaba College of Technology' })]
    const merged = withReviewedInstitutions(rows, [unilag])

    expect(merged).toHaveLength(2)
    expect(merged[1]?.name).toBe('University of Lagos')
    expect(merged[1]?.programmeCount).toBe(1)
  })

  it('adds a school once however many courses it has', () => {
    const merged = withReviewedInstitutions(
      [],
      [unilag, course({ id: 'accounting-unilag', name: 'Accounting', institution: 'University of Lagos' })],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?.programmeCount).toBe(2)
  })

  it('matches an existing row however the two spell the name', () => {
    const rows = [institution({ name: 'UNIVERSITY  OF  LAGOS' })]

    expect(withReviewedInstitutions(rows, [unilag])).toBe(rows)
  })

  it('takes the state and type from the supplied details', () => {
    const merged = withReviewedInstitutions([], [unilag], {
      'University of Lagos': { state: 'Lagos', institutionType: 'University' },
    })

    expect(merged[0]?.state).toBe('Lagos')
    expect(merged[0]?.institutionType).toBe('University')
  })

  it('records no state or type when it has none to record', () => {
    const merged = withReviewedInstitutions([], [unilag])

    expect(merged[0]?.state).toBeNull()
    expect(merged[0]?.institutionType).toBeNull()
  })
})

describe('coursesForInstitution', () => {
  const unilag = course({ id: 'medicine-unilag', name: 'Medicine & Surgery', institution: 'University of Lagos' })

  it('offers a reviewed course the catalogue holds no programmes for', () => {
    const courses = coursesForInstitution([], [unilag], 'University of Lagos')

    expect(courses.map((entry) => entry.name)).toEqual(['Medicine & Surgery'])
    expect(courses[0]?.reviewedCourseId).toBe('medicine-unilag')
  })

  it('offers nothing for a school with neither', () => {
    expect(coursesForInstitution([], [unilag], 'Yaba College of Technology')).toEqual([])
  })

  it('collapses a catalogue programme and a reviewed course of the same name', () => {
    const courses = coursesForInstitution(
      [programme({ programme: 'MEDICINE AND SURGERY' })],
      [unilag],
      'University of Lagos',
    )

    expect(courses).toHaveLength(1)
    expect(courses[0]?.reviewedCourseId).toBe('medicine-unilag')
  })

  it('keeps the checkable listing ahead of the uncheckable ones', () => {
    const courses = coursesForInstitution(
      [
        programme({ programme: 'Agricultural Science' }),
        programme({ programme: 'Computer Science', reviewedCourseId: 'computer-science-unilag' }),
      ],
      [],
      'University of Lagos',
    )

    expect(courses.map((entry) => entry.name)).toEqual(['Computer Science', 'Agricultural Science'])
  })

  it('puts the reviewed courses ahead of the listings', () => {
    const courses = coursesForInstitution(
      [programme({ programme: 'Architecture' })],
      [unilag],
      'University of Lagos',
    )

    expect(courses.map((entry) => entry.name)).toEqual(['Medicine & Surgery', 'Architecture'])
  })

  it('matches the school however the two spell the name', () => {
    expect(coursesForInstitution([], [unilag], 'university of lagos')).toHaveLength(1)
  })
})
