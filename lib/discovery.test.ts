import { describe, expect, it } from 'vitest'

import { COURSES } from '@/lib/db/courses.data'
import { matchProgrammes, type ProgrammeSource } from '@/lib/discovery'

function programme(overrides: Partial<ProgrammeSource> & { programme: string }): ProgrammeSource {
  return {
    institution: 'University of Lagos',
    department: 'Faculty of Science',
    utmeSubjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    sourceUrl: 'https://ibass.jamb.gov.ng/brochure-by-institution',
    ...overrides,
  }
}

describe('matchProgrammes', () => {
  it('finds programmes listing the subjects the student has', () => {
    const [match] = matchProgrammes([programme({ programme: 'Nursing Science' })], ['BIO', 'CHM'])

    expect(match?.programme).toBe('Nursing Science')
    expect(match?.matched).toEqual(['BIO', 'CHM'])
    expect(match?.alsoNeeds).toEqual(['English Language', 'Physics'])
  })

  it('drops programmes that list none of them', () => {
    const law = programme({
      programme: 'Law',
      utmeSubjects: ['English Language', 'Literature in English', 'Government'],
    })

    expect(matchProgrammes([law], ['BIO', 'CHM'])).toEqual([])
  })

  it('ranks the strongest overlap first', () => {
    const partial = programme({
      programme: 'Computer Science',
      utmeSubjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    })
    const strong = programme({ programme: 'Pharmacy' })

    const matches = matchProgrammes([partial, strong], ['BIO', 'CHM'])
    expect(matches.map((match) => match.programme)).toEqual(['Pharmacy', 'Computer Science'])
  })

  it('breaks ties towards a programme the checker can actually decide', () => {
    const unreviewed = programme({ programme: 'Zoology' })
    const reviewed = programme({ programme: 'Medicine and Surgery', reviewedCourseId: 'medicine-unilag' })

    const matches = matchProgrammes([unreviewed, reviewed], ['BIO', 'CHM'])
    expect(matches[0]?.programme).toBe('Medicine and Surgery')
  })

  it('keeps labels our dictionary does not know in front of the student', () => {
    const [match] = matchProgrammes(
      [programme({ programme: 'Creative Arts', utmeSubjects: ['English Language', 'Biology', 'Fine Art'] })],
      ['BIO'],
    )

    expect(match?.matched).toEqual(['BIO'])
    expect(match?.alsoNeeds).toContain('Fine Art')
  })

  it('joins a mirrored row to a reviewed course by normalised name', () => {
    // IBASS writes "and"; our reviewed course is stored with "&".
    const mirrored = programme({ programme: 'Medicine and Surgery', reviewedCourseId: null })

    const [match] = matchProgrammes([mirrored], ['BIO', 'CHM'], { courses: COURSES })
    expect(match?.reviewedCourseId).toBe('medicine-unilag')
  })

  it('never invents a reviewed course for a row nobody reviewed', () => {
    const [match] = matchProgrammes([programme({ programme: 'Nursing Science' })], ['BIO', 'CHM'], {
      courses: COURSES,
    })

    expect(match?.reviewedCourseId).toBeNull()
  })

  it('does not list the same programme twice', () => {
    const matches = matchProgrammes(
      [programme({ programme: 'Pharmacy' }), programme({ programme: 'Pharmacy' })],
      ['BIO', 'CHM'],
    )

    expect(matches).toHaveLength(1)
  })

  it('counts a repeated subject label once', () => {
    const [match] = matchProgrammes(
      [programme({ programme: 'Pharmacy', utmeSubjects: ['Biology', 'Biology', 'Chemistry'] })],
      ['BIO', 'CHM'],
    )

    expect(match?.matched).toEqual(['BIO', 'CHM'])
  })

  it('returns nothing without a subject to search on', () => {
    expect(matchProgrammes([programme({ programme: 'Pharmacy' })], [])).toEqual([])
  })

  it('returns every match, leaving truncation to the caller', () => {
    // The caller has to know the total to say "showing 12 of 31" honestly.
    const many = Array.from({ length: 20 }, (_, i) => programme({ programme: `Programme ${i}` }))
    expect(matchProgrammes(many, ['BIO'])).toHaveLength(20)
  })
})
