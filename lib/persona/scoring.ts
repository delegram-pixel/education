/**
 * Scoring the interest quiz, and matching a student to a course.
 *
 * Like the eligibility engine, this module is pure: no Next, no React, no
 * database, no I/O. Given answers it returns numbers, and given two profiles it
 * returns a match.
 *
 * The important thing to understand before changing anything here is what this
 * feature is FOR. Eligibility is a judgement: the requirements either are or are
 * not met. This is not a judgement. A low alignment score never blocks anything,
 * never contradicts a verdict, and is phrased so that a student who reads it and
 * carries on regardless has not been told they were wrong. It is a prompt to
 * think, offered once, and then dropped.
 */

import { QUIZ_QUESTIONS, LIKERT_POINTS } from '@/lib/persona/questions'
import {
  PERSONA_DIMENSIONS,
  type Course,
  type PersonaDimension,
  type PersonaProfile,
} from '@/lib/types'

/** The midpoint of the 0–100 scale: "no signal either way". */
const NEUTRAL = 50

/* -------------------------------------------------------------------------- */
/* Scoring answers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Turn a set of 1–5 Likert answers into a 0–100 profile.
 *
 * Unanswered questions default to the neutral midpoint (50) rather than being
 * dropped from the profile or treated as a zero. This is a deliberate choice,
 * and it is the one most worth defending:
 *
 *   - Dropping a dimension would change the *shape* of the vector, which the
 *     alignment maths reads as a real preference. A skipped question would
 *     silently move the match rather than leaving it alone.
 *   - Scoring a skip as 0 would read "I hate lab work" when the student only
 *     tapped past the question.
 *
 * 50 centres to zero (see `alignmentScore`), so a skipped question contributes
 * nothing to the match in either direction — which is exactly what not knowing
 * should do. A student can therefore answer three questions and still get a
 * usable, honest result.
 */
export function scoreAnswers(answers: Record<string, number>): PersonaProfile {
  const profile = Object.fromEntries(
    PERSONA_DIMENSIONS.map((dimension) => [dimension, NEUTRAL]),
  ) as PersonaProfile

  for (const question of QUIZ_QUESTIONS) {
    const answer = answers[question.id]

    // Missing, out of range, or not a whole number: treated the same as a skip.
    // Garbage from a stale form should not be able to fabricate a preference.
    if (
      answer === undefined ||
      !Number.isInteger(answer) ||
      answer < 1 ||
      answer > LIKERT_POINTS
    ) {
      continue
    }

    // 1 → 0, 3 → 50, 5 → 100.
    const raw = ((answer - 1) / (LIKERT_POINTS - 1)) * 100

    profile[question.dimension] = question.inverted ? 100 - raw : raw
  }

  return profile
}

/* -------------------------------------------------------------------------- */
/* Alignment                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How well a student's profile matches a course's, as an integer 0–100.
 *
 * The vectors are CENTRED — 50 is subtracted from every component so they run
 * −50…+50 — before the cosine similarity is taken. That step is the whole
 * reason this function is useful.
 *
 * Cosine similarity between two vectors whose components are all positive is
 * bounded well above zero and, in practice, sits somewhere north of 0.9. Run
 * uncentred, every course comes back a "95% match" for every student, the
 * numbers stop distinguishing anything, and the feature is decoration. Centring
 * puts the origin at "no preference", so disagreement can actually point in the
 * opposite direction and the similarity can go negative.
 *
 * The −1…1 result is then mapped onto 0…100, which keeps the full range of the
 * measurement instead of clipping the negative half to zero.
 */
export function alignmentScore(student: PersonaProfile, course: PersonaProfile): number {
  let dot = 0
  let studentMagnitude = 0
  let courseMagnitude = 0

  for (const dimension of PERSONA_DIMENSIONS) {
    const s = student[dimension] - NEUTRAL
    const c = course[dimension] - NEUTRAL

    dot += s * c
    studentMagnitude += s * s
    courseMagnitude += c * c
  }

  // A profile that is neutral on all eight dimensions has no direction, so
  // there is no angle to measure. Returning the midpoint says "we don't know",
  // which is the truth, rather than 0, which would say "badly matched".
  if (studentMagnitude === 0 || courseMagnitude === 0) return NEUTRAL

  const cosine = dot / (Math.sqrt(studentMagnitude) * Math.sqrt(courseMagnitude))
  const scaled = ((cosine + 1) / 2) * 100

  // Floating-point drift can push a perfect match a hair past 100.
  return Math.min(100, Math.max(0, Math.round(scaled)))
}

export type AlignmentBand = 'strong' | 'reasonable' | 'worth_thinking_about'

export function alignmentBand(score: number): AlignmentBand {
  if (score >= 70) return 'strong'
  if (score >= 50) return 'reasonable'
  return 'worth_thinking_about'
}

/**
 * The single dimension on which the student and the course disagree most.
 *
 * One dimension, not a ranked list. A student looking at a course they qualify
 * for should be handed one thing to think about, not a report card — eight
 * gaps listed in order reads as an argument against the course, which is not
 * what this feature is allowed to do.
 *
 * Returns null when the profiles agree exactly, because there is then nothing
 * honest to name.
 */
export function largestMismatch(
  student: PersonaProfile,
  course: PersonaProfile,
): { dimension: PersonaDimension; gap: number } | null {
  let worst: { dimension: PersonaDimension; gap: number } | null = null

  for (const dimension of PERSONA_DIMENSIONS) {
    const gap = Math.abs(student[dimension] - course[dimension])
    if (gap > 0 && (worst === null || gap > worst.gap)) {
      worst = { dimension, gap }
    }
  }

  return worst
}

/* -------------------------------------------------------------------------- */
/* Language                                                                    */
/*                                                                            */
/* Every sentence below is user-facing, and every one of them is read by a     */
/* student who has ALREADY been told they qualify. The rules: name one thing,  */
/* name it specifically, and leave the decision entirely with them. Nothing    */
/* here may read as a recommendation against a course.                        */
/* -------------------------------------------------------------------------- */

type MismatchPhrasing = {
  /** The student scores LOW on this dimension and the course scores HIGH. */
  studentLower: { student: string; course: (years: string) => string }
  /** The student scores HIGH on this dimension and the course scores LOW. */
  studentHigher: { student: string; course: (years: string) => string }
}

const MISMATCH_PHRASING: Record<PersonaDimension, MismatchPhrasing> = {
  handsOn: {
    studentLower: {
      student: "you'd rather work through ideas on paper than with your hands",
      course: (y) => `is practical and hands-on for most of its ${y} years`,
    },
    studentHigher: {
      student: 'you like working with your hands',
      course: (y) => `is mostly reading, writing and analysis across its ${y} years`,
    },
  },
  peopleFacing: {
    studentLower: {
      student: "you'd rather work on your own than with a stream of new people",
      course: (y) => `puts you in front of people for most of its ${y} years`,
    },
    studentHigher: {
      student: 'you enjoy being around people all day',
      course: (y) => `is largely solo work across its ${y} years`,
    },
  },
  mathComfort: {
    studentLower: {
      student: 'maths is not where you feel strongest',
      course: (y) => `leans on maths in every one of its ${y} years`,
    },
    studentHigher: {
      student: "you're happiest when a problem turns into maths",
      course: (y) => `uses less maths than you might want over its ${y} years`,
    },
  },
  labTolerance: {
    studentLower: {
      student: "you'd rather avoid lab work",
      course: (y) => `is lab-heavy for all ${y} years`,
    },
    studentHigher: {
      student: 'you enjoy lab work',
      course: (y) => `spends very little time in a laboratory over its ${y} years`,
    },
  },
  memorisation: {
    studentLower: {
      student: "you'd rather reason something out than learn it by heart",
      course: (y) => `asks for a great deal of memorisation across its ${y} years`,
    },
    studentHigher: {
      student: "you're comfortable learning things by heart",
      course: (y) => `rewards working things out more than memory over its ${y} years`,
    },
  },
  creativity: {
    studentLower: {
      student: "you'd rather follow a worked example than invent your own approach",
      course: (y) => `expects your own approach often across its ${y} years`,
    },
    studentHigher: {
      student: 'you like starting from a blank page',
      course: (y) => `follows set methods and standards for most of its ${y} years`,
    },
  },
  structurePreference: {
    studentLower: {
      student: "you'd rather set your own order of work",
      course: (y) => `runs to a fixed timetable for all ${y} years`,
    },
    studentHigher: {
      student: 'you like a clear timetable to work to',
      course: (y) => `leaves much of the planning to you across its ${y} years`,
    },
  },
  longTrainingTolerance: {
    studentLower: {
      student: "you'd rather not still be studying years from now",
      course: (y) => `takes ${y} years before you qualify`,
    },
    studentHigher: {
      student: "you're ready for a long stretch of training",
      course: (y) => `is finished in ${y} years`,
    },
  },
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

/** "six" reads better than "6" mid-sentence; anything unusual falls back to the numeral. */
function durationWord(years: number): string {
  return NUMBER_WORDS[years] ?? String(years)
}

/**
 * One sentence, or nothing at all.
 *
 * Returns null for anything better than a `worth_thinking_about` match. A
 * student whose profile fits has nothing to gain from being told so in a second
 * place, and a caveat attached to a good match trains students to ignore the
 * caveat when it matters.
 *
 * When it does fire, the sentence opens by re-confirming eligibility. That
 * order is not decoration: the student has just been told they qualify, and
 * anything that follows will be read as a retraction unless the sentence says
 * otherwise first.
 */
export function alignmentNote(
  score: number,
  student: PersonaProfile,
  course: Course,
): string | null {
  if (alignmentBand(score) !== 'worth_thinking_about') return null

  const mismatch = largestMismatch(student, course.personaProfile)
  if (!mismatch) return null

  const { dimension } = mismatch
  const phrasing = MISMATCH_PHRASING[dimension]
  const years = durationWord(course.durationYears)

  // Which way round the gap runs decides the wording entirely. "You'd rather
  // avoid lab work, and this course is lab-heavy" and "you enjoy lab work, and
  // this course has almost none" are the same gap and completely different
  // sentences.
  const side =
    student[dimension] < course.personaProfile[dimension]
      ? phrasing.studentLower
      : phrasing.studentHigher

  return `You qualify for this course. One thing worth thinking about: you told us ${side.student}, and this course ${side.course(years)}.`
}
