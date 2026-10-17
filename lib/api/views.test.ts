import { describe, expect, it } from 'vitest'

import type { CatalogueInstitution, SwiftKnowledgeProgramme } from '@/lib/db/catalogue'
import { GRADES, SUBJECT_CODES } from '@/lib/types'

import { checkerUrl, institutionView, programmeDetail, programmeSummary, subjectVocabulary } from './views'

const institution: CatalogueInstitution = {
  id: 'unilag',
  name: 'UNIVERSITY OF LAGOS, AKOKA, LAGOS STATE',
  institutionType: 'Federal University',
  category: 'University',
  state: 'Lagos',
  programmeCount: 62,
  sourceUrl: 'https://ibass.jamb.gov.ng/brochure-by-institution',
  sourceUpdatedAt: new Date('2026-09-22T10:00:00Z'),
}

const programme: SwiftKnowledgeProgramme = {
  institutionId: 'unilag',
  institution: 'UNIVERSITY OF LAGOS, AKOKA, LAGOS STATE',
  programme: 'Nursing Science',
  department: 'Nursing',
  status: 'Available',
  utmeSubjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
  olevelRequirements: 'Five credits including English, Mathematics, Biology and Chemistry.',
  directEntryRequirements: null,
  remarks: 'Use the institution bulletin to confirm the current session.',
  sourceUrl: 'https://ibass.jamb.gov.ng/brochure-by-institution',
  sourceUpdatedAt: new Date('2026-09-22T10:00:00Z'),
  programmeId: 'unilag:1042',
  ruleStatus: 'ready',
  reviewedCourseId: 'unilag-nursing',
}

describe('institutionView', () => {
  it('serialises an instant as UTC ISO 8601, not as a Date', () => {
    expect(institutionView(institution).sourceUpdatedAt).toBe('2026-09-22T10:00:00.000Z')
  })

  // "does UNIVERSITY OF LAGOS, AKOKA, LAGOS STATE offer Nursing?" is not a
  // sentence anybody writes.
  it('carries the name as a sentence would use it', () => {
    expect(institutionView(institution).shortName).toBe('UNIVERSITY OF LAGOS')
  })

  it('leaves a recorded state alone', () => {
    expect(institutionView(institution).state).toBe('Lagos')
  })

  it('reports an unrecorded dimension as null rather than omitting it', () => {
    const view = institutionView({ ...institution, state: null, category: null, institutionType: null })

    expect(view.state).toBeNull()
    expect(view.category).toBeNull()
    expect(view.type).toBeNull()
    expect('state' in view).toBe(true)
  })
})

describe('programmeSummary', () => {
  it('uses the mirror id when there is one, so a client can hold it', () => {
    expect(programmeSummary(programme).id).toBe('unilag:1042')
  })

  it('derives an id for a row that has none, so every id resolves', () => {
    const view = programmeSummary({ ...programme, programmeId: null })
    expect(view.id).toBe('sample:university-of-lagos-akoka-lagos-state:nursing-science')
  })

  it('fills in an institution id for a row that carries none', () => {
    const view = programmeSummary({ ...programme, institutionId: undefined })
    expect(view.institutionId).toBe('university-of-lagos-akoka-lagos-state')
  })

  // The prose is the largest thing in a catalogue row and a list of thirty
  // search results renders none of it.
  it('leaves the brochure prose out, even when the row was read with it', () => {
    const view = programmeSummary(programme)

    expect('olevelRequirements' in view).toBe(false)
    expect('directEntryRequirements' in view).toBe(false)
    expect('remarks' in view).toBe(false)
  })

  it('reports absent optional fields as null, not as undefined', () => {
    const view = programmeSummary({
      ...programme,
      reviewedCourseId: undefined,
      ruleStatus: undefined,
      department: null,
    })

    expect(view.reviewedCourseId).toBeNull()
    expect(view.ruleStatus).toBeNull()
    expect(view.department).toBeNull()
  })

  it('keeps the UTME subjects as the brochure published them', () => {
    // Not mapped to codes: "Government/History" has no code and folding the
    // entries that do would silently shorten the combination.
    const view = programmeSummary({ ...programme, utmeSubjects: ['English Language', 'Government/History'] })
    expect(view.utmeSubjects).toEqual(['English Language', 'Government/History'])
  })
})

describe('programmeDetail', () => {
  it('carries the prose as quoted, with the URL it came from', () => {
    const view = programmeDetail(programme, 'https://app.example')

    expect(view.olevelRequirements).toBe(programme.olevelRequirements)
    expect(view.remarks).toBe(programme.remarks)
    expect(view.sourceUrl).toBe(programme.sourceUrl)
  })

  it('reports prose that was not read as null rather than leaving it out', () => {
    // All three, not just one: `PROSE_COLUMNS` omits every prose field on a
    // listing read, so the "not read" case is all three absent at once. Clearing
    // only `olevelRequirements` would leave the fixture's `remarks` in place and
    // quietly assert the opposite of what this test is for.
    const view = programmeDetail(
      {
        ...programme,
        olevelRequirements: undefined,
        directEntryRequirements: undefined,
        remarks: undefined,
      },
      null,
    )

    expect(view.olevelRequirements).toBeNull()
    expect(view.directEntryRequirements).toBeNull()
    expect(view.remarks).toBeNull()
  })

  it('offers a link into the checker where the checker has the course', () => {
    const view = programmeDetail(programme, 'https://app.example')
    expect(view.checkerUrl).toBe('https://app.example/check?course=unilag-nursing')
  })

  it('offers no link where the checker has no course — the ordinary case', () => {
    const view = programmeDetail({ ...programme, reviewedCourseId: null }, 'https://app.example')
    expect(view.checkerUrl).toBeNull()
  })

  it('offers no link and no half-built URL when the app address is unknown', () => {
    expect(programmeDetail(programme, null).checkerUrl).toBeNull()
  })

  it('still carries every list field, so a detail read is a superset', () => {
    const detail = programmeDetail(programme, 'https://app.example')
    expect(detail).toMatchObject(programmeSummary(programme))
  })
})

describe('checkerUrl', () => {
  it('escapes an id rather than pasting it into a query string', () => {
    expect(checkerUrl('a b&c=d', 'https://app.example')).toBe(
      'https://app.example/check?course=a%20b%26c%3Dd',
    )
  })
})

describe('subjectVocabulary', () => {
  it('lists every subject code this catalogue uses', () => {
    const { subjects } = subjectVocabulary()

    expect(subjects.map((s) => s.code)).toEqual(SUBJECT_CODES)
    expect(subjects.find((s) => s.code === 'MTH')?.name).toBe('Mathematics')
  })

  it('lists every grade, in order', () => {
    expect(subjectVocabulary().grades.map((g) => g.code)).toEqual([...GRADES])
  })

  // The one rule a client cannot be left to guess, and the one this codebase
  // warns about more than any other.
  it('marks exactly A1 to C6 as credits', () => {
    const { grades } = subjectVocabulary()
    const credits = grades.filter((g) => g.credit).map((g) => g.code)

    expect(credits).toEqual(['A1', 'B2', 'B3', 'C4', 'C5', 'C6'])
    expect(grades.find((g) => g.code === 'D7')?.credit).toBe(false)
    expect(grades.find((g) => g.code === 'E8')?.credit).toBe(false)
    expect(grades.find((g) => g.code === 'F9')?.credit).toBe(false)
  })

  it('says what each grade means rather than leaving the code bare', () => {
    for (const grade of subjectVocabulary().grades) {
      expect(grade.meaning.length).toBeGreaterThan(0)
    }
  })

  it('names the subjects every course requires', () => {
    expect(subjectVocabulary().alwaysRequired).toEqual(['ENG', 'MTH'])
  })
})
