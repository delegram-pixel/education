/**
 * The interest quiz.
 *
 * This is the *secondary* feature. Eligibility answers "can you get in?"; this
 * answers something much softer — "are you likely to enjoy this, and stay?" —
 * and it is never allowed to overrule a verdict. Everything here is written to
 * be read by a 17-year-old in a hurry.
 *
 * Two rules shape the wording:
 *
 *   1. Every prompt describes a SITUATION, not a personality. "I am a practical
 *      person" invites a self-image; "I would rather open it up and look inside"
 *      invites a memory. Only the second one produces an honest answer.
 *
 *   2. Some prompts are inverted, so agreeing with everything does not produce
 *      a perfect score on everything. A student who straight-lines the quiz gets
 *      a mixed profile back, which is both more truthful and a quiet signal that
 *      the quiz noticed.
 */

import type { PersonaDimension } from '@/lib/types'

export type QuizQuestion = {
  id: string
  dimension: PersonaDimension
  /** First person, concrete, about a real situation. */
  prompt: string
  /** Labels for the 5-point scale, index 0 = strongly disagree. */
  scale: [string, string, string, string, string]
  /** When true, agreement means a LOW score on the dimension. */
  inverted: boolean
}

/** Points on the Likert scale. Answers arrive as 1…LIKERT_POINTS. */
export const LIKERT_POINTS = 5

/**
 * Eight questions, one per dimension.
 *
 * The order is deliberate: something physical and easy to picture first, then
 * the social question, then the three academic ones, and the length-of-training
 * question last. Asking "are you willing to still be a student in six years"
 * before a student has warmed up gets a defensive answer, so it goes at the end
 * where the rest of the quiz has already set the tone.
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'taking-things-apart',
    dimension: 'handsOn',
    prompt:
      'When something at home stops working, I would rather open it up and look inside than wait for someone else to fix it.',
    scale: [
      'I would never open it',
      'Probably not me',
      'Depends on the thing',
      'Usually I would',
      "I've already done it",
    ],
    inverted: false,
  },
  {
    id: 'day-of-strangers',
    dimension: 'peopleFacing',
    prompt:
      'I would happily spend most of my working day talking to people I have never met before.',
    scale: [
      'I would dread that',
      'I would rather not',
      'Some days, yes',
      'I would enjoy that',
      'That is exactly what I want',
    ],
    inverted: false,
  },
  {
    id: 'page-of-equations',
    dimension: 'mathComfort',
    prompt:
      'When a problem turns into a page of equations, I settle in rather than look for a way round it.',
    scale: [
      'I look for a way round it',
      'Not really me',
      'Depends on the problem',
      'Mostly true of me',
      'The equations are the good part',
    ],
    inverted: false,
  },
  {
    // INVERTED. Agreeing here means a low tolerance for lab work.
    id: 'long-afternoon-in-the-lab',
    dimension: 'labTolerance',
    prompt:
      'Three hours in a laboratory, in a coat and gloves, repeating the same measurement, sounds like a very long afternoon to me.',
    scale: [
      'I would enjoy that afternoon',
      'I would not mind it',
      'Depends on the day',
      'Fairly true of me',
      'That is a very long afternoon',
    ],
    inverted: true,
  },
  {
    id: 'lists-by-heart',
    dimension: 'memorisation',
    prompt:
      'I do not mind learning long lists by heart — bones, dates, formulas — and being tested on them a week later.',
    scale: [
      'I would find that painful',
      'I would rather not',
      'I can manage it',
      'I do not mind it',
      'I am good at that',
    ],
    inverted: false,
  },
  {
    id: 'blank-page',
    dimension: 'creativity',
    prompt:
      'Given a blank page and an open brief, I start sketching my own ideas rather than looking for an example to follow.',
    scale: [
      'I want an example first',
      'Usually an example',
      'Half and half',
      'Usually my own ideas',
      'Always my own ideas',
    ],
    inverted: false,
  },
  {
    // INVERTED. Agreeing here means a low preference for imposed structure.
    id: 'no-timetable',
    dimension: 'structurePreference',
    prompt:
      'I do my best work when nobody has handed me a timetable and I can decide the order myself.',
    scale: [
      'Give me the timetable',
      'I prefer a timetable',
      'Either works for me',
      'I prefer to choose',
      'I much prefer to choose',
    ],
    inverted: true,
  },
  {
    id: 'still-a-student',
    dimension: 'longTrainingTolerance',
    prompt:
      'I am willing to still be a student six or seven years from now if the career at the end is worth it.',
    scale: [
      'That is too long for me',
      'That is a lot to ask',
      'I am honestly not sure',
      'I could do that',
      'I am ready for it',
    ],
    inverted: false,
  },
]
