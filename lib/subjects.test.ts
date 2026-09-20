import { describe, expect, it } from 'vitest'

import { normaliseSubject, parseSubjects, subjectOptions } from '@/lib/subjects'

describe('normaliseSubject', () => {
  it('reads the labels IBASS publishes', () => {
    expect(normaliseSubject('English Language')).toBe('ENG')
    expect(normaliseSubject('Literature in English')).toBe('LIT')
    expect(normaliseSubject('Agricultural Science')).toBe('AGR')
  })

  it('reads the shorthand students type', () => {
    expect(normaliseSubject('bio')).toBe('BIO')
    expect(normaliseSubject('Chem')).toBe('CHM')
    expect(normaliseSubject('f/maths')).toBe('FMA')
    expect(normaliseSubject('use of english')).toBe('ENG')
    expect(normaliseSubject('econs')).toBe('ECO')
  })

  it('folds punctuation and spacing', () => {
    expect(normaliseSubject('  Further   Mathematics ')).toBe('FMA')
    expect(normaliseSubject('Food & Nutrition')).toBe('FDN')
  })

  it('returns null for anything it does not know', () => {
    expect(normaliseSubject('General Paper')).toBeNull()
    expect(normaliseSubject('')).toBeNull()
  })
})

describe('parseSubjects', () => {
  it('reads a whole sentence', () => {
    expect(parseSubjects('Biology and Chemistry')).toEqual(['BIO', 'CHM'])
  })

  it('accepts commas, ampersands and slashes as separators', () => {
    expect(parseSubjects('biology, chemistry')).toEqual(['BIO', 'CHM'])
    expect(parseSubjects('Biology & Chemistry')).toEqual(['BIO', 'CHM'])
  })

  it('does not split a subject whose name contains "and"', () => {
    // The naive split-on-"and" bug lives here.
    expect(parseSubjects('Food and Nutrition')).toEqual(['FDN'])
  })

  it('prefers the longest phrase, leaving no stray subject behind', () => {
    // "Further Mathematics" must not also yield MTH.
    expect(parseSubjects('Further Mathematics')).toEqual(['FMA'])
    expect(parseSubjects('Further Maths and Physics')).toEqual(['PHY', 'FMA'])
  })

  it('does not match a subject inside a longer word', () => {
    expect(parseSubjects('Microbiology')).toEqual([])
  })

  it('drops unknown words rather than failing the whole entry', () => {
    expect(parseSubjects('Biology, General Paper, Chemistry')).toEqual(['BIO', 'CHM'])
  })

  it('dedupes and always reports in canonical order', () => {
    expect(parseSubjects('Chemistry and Biology')).toEqual(['BIO', 'CHM'])
    expect(parseSubjects('Biology, Biology')).toEqual(['BIO'])
    expect(parseSubjects('Chemistry, Biology, Chemistry')).toEqual(['BIO', 'CHM'])
  })

  it('returns nothing for empty input', () => {
    expect(parseSubjects('')).toEqual([])
    expect(parseSubjects('   ')).toEqual([])
  })
})

describe('subjectOptions', () => {
  it('offers every canonical subject, in order', () => {
    const options = subjectOptions()
    expect(options).toHaveLength(23)
    expect(options[0]).toEqual({ code: 'ENG', name: 'English Language' })
    expect(options.map((option) => option.code)).toContain('FDN')
  })
})
