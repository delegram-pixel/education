import { describe, expect, it } from 'vitest'

import { getCourse } from '@/lib/db/courses.data'
import { QUIZ_QUESTIONS } from '@/lib/persona/questions'
import {
  alignmentBand,
  alignmentNote,
  alignmentScore,
  largestMismatch,
  scoreAnswers,
} from '@/lib/persona/scoring'
import { PERSONA_DIMENSIONS, type PersonaDimension, type PersonaProfile } from '@/lib/types'

const medicine = getCourse('medicine-unilag')!
const computerScience = getCourse('computer-science-unilag')!
const accounting = getCourse('accounting-unilag')!

const ALL_COURSES = [medicine, computerScience, accounting]

/** Words and phrases that would turn guidance into a verdict. */
const FORBIDDEN = ['unsuitable', 'wrong', "shouldn't", 'avoid this course']

/** Answer every question with the same value, e.g. straight-lining a 5. */
function straightLine(value: number): Record<string, number> {
  return Object.fromEntries(QUIZ_QUESTIONS.map((q) => [q.id, value]))
}

function questionFor(dimension: PersonaDimension) {
  return QUIZ_QUESTIONS.find((q) => q.dimension === dimension)!
}

/**
 * A student who is strong on maths, wants nothing to do with a laboratory, and
 * would rather not spend the day talking to strangers. On the face of it they
 * qualify for all three courses; the point of this feature is that the three
 * should not feel equally like home.
 */
const LAB_AVERSE_ANSWERS: Record<string, number> = {
  'taking-things-apart': 4,
  'day-of-strangers': 1,
  'page-of-equations': 5,
  'long-afternoon-in-the-lab': 5, // inverted — agreement means "not the lab for me"
  'lists-by-heart': 2,
  'blank-page': 4,
  'no-timetable': 3, // inverted — no strong feeling either way
  'still-a-student': 2,
}

const labAverse = scoreAnswers(LAB_AVERSE_ANSWERS)

describe('the quiz itself', () => {
  it('asks exactly eight questions, one per dimension', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(8)

    const dimensions = QUIZ_QUESTIONS.map((q) => q.dimension).sort()
    expect(dimensions).toEqual([...PERSONA_DIMENSIONS].sort())
  })

  it('gives every question a unique id and five scale labels', () => {
    const ids = new Set(QUIZ_QUESTIONS.map((q) => q.id))
    expect(ids.size).toBe(QUIZ_QUESTIONS.length)

    for (const q of QUIZ_QUESTIONS) {
      expect(q.scale, q.id).toHaveLength(5)
      expect(q.prompt.length, q.id).toBeGreaterThan(20)
    }
  })

  it('inverts at least two questions so the quiz cannot be agreed into a perfect score', () => {
    expect(QUIZ_QUESTIONS.filter((q) => q.inverted).length).toBeGreaterThanOrEqual(2)
  })

  it('does not open with the length-of-training question', () => {
    // It is the heaviest question in the set. Asking it cold gets a defensive
    // answer rather than an honest one.
    expect(QUIZ_QUESTIONS[0]?.dimension).not.toBe('longTrainingTolerance')
  })

  it('keeps the prompts plain — no emoji, no exclamation marks', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.prompt, q.id).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(q.prompt, q.id).not.toContain('!')
    }
  })
})

describe('scoreAnswers', () => {
  it('returns a profile of all 50s when every answer is the neutral midpoint', () => {
    const profile = scoreAnswers(straightLine(3))

    for (const dimension of PERSONA_DIMENSIONS) {
      expect(profile[dimension], dimension).toBe(50)
    }
  })

  it('defaults unanswered questions to 50 rather than dropping or zeroing them', () => {
    // Deliberate: a skip must contribute nothing to the match, not a preference.
    const profile = scoreAnswers({})

    for (const dimension of PERSONA_DIMENSIONS) {
      expect(profile[dimension], dimension).toBe(50)
    }
  })

  it('maps a partial answer set without disturbing the questions that were skipped', () => {
    const profile = scoreAnswers({ [questionFor('mathComfort').id]: 5 })

    expect(profile.mathComfort).toBe(100)
    expect(profile.handsOn).toBe(50)
    expect(profile.longTrainingTolerance).toBe(50)
  })

  it('maps the five points of the scale onto 0, 25, 50, 75 and 100', () => {
    const maths = questionFor('mathComfort')
    expect(maths.inverted).toBe(false)

    const values = [1, 2, 3, 4, 5].map((a) => scoreAnswers({ [maths.id]: a }).mathComfort)
    expect(values).toEqual([0, 25, 50, 75, 100])
  })

  it('actually inverts the inverted questions', () => {
    const inverted = QUIZ_QUESTIONS.filter((q) => q.inverted)
    expect(inverted.length).toBeGreaterThan(0)

    for (const q of inverted) {
      // Strong agreement means a LOW score on the dimension, and vice versa.
      expect(scoreAnswers({ [q.id]: 5 })[q.dimension], q.id).toBe(0)
      expect(scoreAnswers({ [q.id]: 1 })[q.dimension], q.id).toBe(100)
    }

    for (const q of QUIZ_QUESTIONS.filter((x) => !x.inverted)) {
      expect(scoreAnswers({ [q.id]: 5 })[q.dimension], q.id).toBe(100)
      expect(scoreAnswers({ [q.id]: 1 })[q.dimension], q.id).toBe(0)
    }
  })

  it('gives a straight-line response a mixed profile, not a perfect one', () => {
    // Agreeing with everything is the obvious way to try to game this. The
    // inverted questions are what stop it working.
    const profile = scoreAnswers(straightLine(5))
    const distinct = new Set(PERSONA_DIMENSIONS.map((d) => profile[d]))

    expect(distinct.size).toBeGreaterThan(1)
    expect([...distinct]).toContain(0)
  })

  it('treats out-of-range and non-integer answers as skips', () => {
    const maths = questionFor('mathComfort')

    for (const bad of [0, 6, -3, 2.5, Number.NaN]) {
      expect(scoreAnswers({ [maths.id]: bad }).mathComfort, String(bad)).toBe(50)
    }
  })
})

describe('alignmentScore', () => {
  it('returns an integer between 0 and 100 for every student and course', () => {
    const students = [
      labAverse,
      scoreAnswers({}),
      scoreAnswers(straightLine(1)),
      scoreAnswers(straightLine(5)),
    ]

    for (const student of students) {
      for (const course of ALL_COURSES) {
        const score = alignmentScore(student, course.personaProfile)

        expect(Number.isInteger(score), course.id).toBe(true)
        expect(score, course.id).toBeGreaterThanOrEqual(0)
        expect(score, course.id).toBeLessThanOrEqual(100)
      }
    }
  })

  it('scores a profile against itself as a perfect match', () => {
    expect(alignmentScore(medicine.personaProfile, medicine.personaProfile)).toBe(100)
  })

  it('scores an exactly opposite profile as a total mismatch', () => {
    const opposite = Object.fromEntries(
      PERSONA_DIMENSIONS.map((d) => [d, 100 - medicine.personaProfile[d]]),
    ) as PersonaProfile

    expect(alignmentScore(opposite, medicine.personaProfile)).toBe(0)
  })

  it('returns the neutral midpoint for a student with no preferences at all', () => {
    // An all-50 profile has no direction, so there is no angle to measure.
    expect(alignmentScore(scoreAnswers({}), medicine.personaProfile)).toBe(50)
  })

  it('ranks Computer Science above Medicine for a lab-averse, people-averse, maths-strong student', () => {
    const cs = alignmentScore(labAverse, computerScience.personaProfile)
    const med = alignmentScore(labAverse, medicine.personaProfile)

    expect(cs).toBeGreaterThan(med)
  })

  it('spreads the three courses out instead of calling them all a 95% match', () => {
    // The regression this guards is real: uncentred cosine similarity between
    // two all-positive vectors sits north of 0.9 for everything, and every
    // course comes back a near-perfect match. If this test ever fails by the
    // scores bunching together, the centring step has been lost.
    const scores = ALL_COURSES.map((c) => alignmentScore(labAverse, c.personaProfile))
    const spread = Math.max(...scores) - Math.min(...scores)

    expect(spread).toBeGreaterThan(5)
  })
})

describe('alignmentBand', () => {
  it('bands on the documented thresholds', () => {
    expect(alignmentBand(100)).toBe('strong')
    expect(alignmentBand(70)).toBe('strong')
    expect(alignmentBand(69)).toBe('reasonable')
    expect(alignmentBand(50)).toBe('reasonable')
    expect(alignmentBand(49)).toBe('worth_thinking_about')
    expect(alignmentBand(0)).toBe('worth_thinking_about')
  })
})

describe('largestMismatch', () => {
  it('returns null when the profiles agree exactly', () => {
    expect(largestMismatch(medicine.personaProfile, medicine.personaProfile)).toBeNull()
  })

  it('names the single widest gap', () => {
    const student: PersonaProfile = { ...accounting.personaProfile, labTolerance: 100 }
    const mismatch = largestMismatch(student, accounting.personaProfile)

    expect(mismatch).toEqual({ dimension: 'labTolerance', gap: 86 })
  })

  it('picks lab tolerance out for the lab-averse student against Medicine', () => {
    expect(largestMismatch(labAverse, medicine.personaProfile)?.dimension).toBe('labTolerance')
  })
})

describe('alignmentNote', () => {
  it('says nothing at all about a strong match', () => {
    const score = alignmentScore(labAverse, computerScience.personaProfile)

    expect(alignmentBand(score)).toBe('strong')
    expect(alignmentNote(score, labAverse, computerScience)).toBeNull()
  })

  it('says nothing about a merely reasonable match either', () => {
    // A caveat attached to a decent match trains students to skip the caveat
    // when it matters.
    expect(alignmentNote(60, labAverse, accounting)).toBeNull()
    expect(alignmentNote(50, labAverse, accounting)).toBeNull()
  })

  it('offers one specific sentence when the match is worth thinking about', () => {
    const score = alignmentScore(labAverse, medicine.personaProfile)
    expect(alignmentBand(score)).toBe('worth_thinking_about')

    const note = alignmentNote(score, labAverse, medicine)

    expect(note).not.toBeNull()
    expect(note).toContain('You qualify for this course.')
    expect(note).toContain('One thing worth thinking about:')
    expect(note).toContain('lab')
    // Six years, read off Medicine's own duration rather than hardcoded.
    expect(note).toContain('six')
    expect(note?.split('. ')).toHaveLength(2)
  })

  it('reads the duration off the course rather than assuming Medicine', () => {
    // Accounting is four years, and a student who wants the lab gets the
    // opposite half of the same sentence.
    const student: PersonaProfile = { ...accounting.personaProfile, labTolerance: 100 }
    const note = alignmentNote(10, student, accounting)

    expect(note).toContain('four years')
    expect(note).not.toContain('six')
  })

  it('never phrases guidance as a decision, for any course or any dimension', () => {
    // Every branch of the phrasing table, both directions, all three courses.
    for (const course of ALL_COURSES) {
      for (const dimension of PERSONA_DIMENSIONS) {
        for (const extreme of [0, 100]) {
          const student: PersonaProfile = { ...course.personaProfile, [dimension]: extreme }
          const note = alignmentNote(10, student, course)
          const label = `${course.id}/${dimension}/${extreme}`

          expect(note, label).not.toBeNull()
          const lower = (note ?? '').toLowerCase()

          for (const word of FORBIDDEN) {
            expect(lower, `${label} — "${word}"`).not.toContain(word)
          }

          expect(lower, label).toContain('you qualify for this course.')
          expect(note, label).not.toContain('!')
        }
      }
    }
  })
})

describe('the lab-averse student, end to end', () => {
  it('produces a usable ranking across the whole catalogue', () => {
    const ranked = ALL_COURSES.map((course) => ({
      id: course.id,
      score: alignmentScore(labAverse, course.personaProfile),
    })).sort((a, b) => b.score - a.score)

    expect(ranked.map((r) => r.id)).toEqual([
      'computer-science-unilag',
      'accounting-unilag',
      'medicine-unilag',
    ])

    // Only the bottom of the ranking gets a note. The other two are left alone.
    const notes = ALL_COURSES.map((course) =>
      alignmentNote(alignmentScore(labAverse, course.personaProfile), labAverse, course),
    )

    expect(notes.filter((n) => n !== null)).toHaveLength(1)
  })
})
