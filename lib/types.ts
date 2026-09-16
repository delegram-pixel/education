/**
 * Shared domain types and validation schemas.
 *
 * The grading model here is WAEC/NECO, and the distinction that matters most is
 * credit vs. pass: D7 and E8 are *passes* but they are NOT credits, and they do
 * not satisfy a subject requirement. Getting this wrong is the single most
 * common bug in eligibility checkers, so it is encoded once, here, and nowhere
 * else in the codebase.
 */

import { z } from 'zod'

/* -------------------------------------------------------------------------- */
/* Grades                                                                      */
/* -------------------------------------------------------------------------- */

export const GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'] as const
export type Grade = (typeof GRADES)[number]

/** Index of C6 — the last grade that counts as a credit pass. */
const LOWEST_CREDIT_INDEX = 5

export function gradeRank(grade: Grade): number {
  return GRADES.indexOf(grade)
}

/** A1–C6 are credits. D7/E8 are passes but not credits. F9 is a fail. */
export function isCredit(grade: Grade): boolean {
  return gradeRank(grade) <= LOWEST_CREDIT_INDEX
}

/** True when `a` is the better (higher) grade. */
export function isBetterGrade(a: Grade, b: Grade): boolean {
  return gradeRank(a) < gradeRank(b)
}

export const GRADE_MEANING: Record<Grade, string> = {
  A1: 'Excellent — counts as a credit',
  B2: 'Very good — counts as a credit',
  B3: 'Good — counts as a credit',
  C4: 'Credit',
  C5: 'Credit',
  C6: 'Credit — the lowest grade that still counts',
  D7: 'A pass, but not a credit',
  E8: 'A pass, but not a credit',
  F9: 'Fail',
}

/* -------------------------------------------------------------------------- */
/* Subjects                                                                    */
/* -------------------------------------------------------------------------- */

export const SUBJECTS = {
  ENG: 'English Language',
  MTH: 'Mathematics',
  BIO: 'Biology',
  CHM: 'Chemistry',
  PHY: 'Physics',
  FMA: 'Further Mathematics',
  AGR: 'Agricultural Science',
  ECO: 'Economics',
  GOV: 'Government',
  CMM: 'Commerce',
  ACC: 'Financial Accounting',
  GEO: 'Geography',
  LIT: 'Literature in English',
  HIS: 'History',
  CRS: 'Christian Religious Studies',
  IRS: 'Islamic Religious Studies',
  CVE: 'Civic Education',
  TCD: 'Technical Drawing',
  FDN: 'Food and Nutrition',
  FRE: 'French',
  YOR: 'Yoruba',
  IGB: 'Igbo',
  HAU: 'Hausa',
} as const

export type SubjectCode = keyof typeof SUBJECTS
export const SUBJECT_CODES = Object.keys(SUBJECTS) as SubjectCode[]

export function subjectName(code: SubjectCode): string {
  return SUBJECTS[code]
}

/** "Physics and Chemistry" / "Physics, Chemistry and Biology" */
export function listSubjects(codes: SubjectCode[]): string {
  const names = codes.map(subjectName)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Subjects a student cannot remove from the form — every course needs them. */
export const ALWAYS_REQUIRED: SubjectCode[] = ['ENG', 'MTH']

/* -------------------------------------------------------------------------- */
/* Results and rules                                                           */
/* -------------------------------------------------------------------------- */

export const MAX_SUBJECT_ROWS = 9

export const oLevelResultSchema = z.object({
  subject: z.enum(SUBJECT_CODES as [SubjectCode, ...SubjectCode[]]),
  grade: z.enum(GRADES),
  /** Results may be combined across at most two sittings. */
  sitting: z.union([z.literal(1), z.literal(2)]).default(1),
})

export type OLevelResult = z.infer<typeof oLevelResultSchema>

export const resultSetSchema = z
  .array(oLevelResultSchema)
  .min(5, 'Enter at least five subjects — most courses need five credits.')
  .max(MAX_SUBJECT_ROWS, `You can enter up to ${MAX_SUBJECT_ROWS} subjects.`)
  .superRefine((results, ctx) => {
    const seen = new Set<string>()
    results.forEach((r, i) => {
      const key = `${r.subject}:${r.sitting}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'subject'],
          message: `You've already entered ${subjectName(r.subject)} for this sitting.`,
        })
      }
      seen.add(key)
    })
    for (const required of ALWAYS_REQUIRED) {
      if (!results.some((r) => r.subject === required)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [0, 'subject'],
          message: `${subjectName(required)} is required for every course.`,
        })
      }
    }
  })

/** "Any N of these subjects" — e.g. any 2 science subjects. */
export type AnyOfGroup = {
  subjects: SubjectCode[]
  count: number
  /** Short human label, e.g. "science subjects". */
  label: string
}

export type OLevelRule = {
  minCredits: number
  mandatory: SubjectCode[]
  anyOf?: AnyOfGroup[]
  maxSittings: number
}

export type UtmeRule = {
  /** Always English Language in practice, kept explicit rather than assumed. */
  compulsory: SubjectCode[]
  chooseFrom: SubjectCode[]
  choose: number
}

/* -------------------------------------------------------------------------- */
/* Verdict                                                                     */
/* -------------------------------------------------------------------------- */

export type VerdictStatus = 'eligible' | 'partial' | 'not_eligible'

export type MissingRequirement = {
  subject: SubjectCode
  reason: 'absent' | 'below_credit'
  grade?: Grade
}

export type UnmetGroup = {
  subjects: SubjectCode[]
  label: string
  need: number
  have: number
}

export type Verdict = {
  status: VerdictStatus
  creditCount: number
  satisfied: { subject: SubjectCode; grade: Grade }[]
  missing: MissingRequirement[]
  /** Deficits against "any N of…" groups, which have no single named subject. */
  unmetGroups: UnmetGroup[]
  /** How many credits short of the minimum, after counting what's present. */
  shortfall: number
  /** The number of distinct things standing between the student and a yes. */
  blockers: number
  sittingsUsed: number
  /** One plain-language sentence. No jargon, no blame. */
  explanation: string
  nextSteps: string[]
}

/* -------------------------------------------------------------------------- */
/* Courses                                                                     */
/* -------------------------------------------------------------------------- */

/** The eight dimensions the interest quiz and each course are scored on. */
export const PERSONA_DIMENSIONS = [
  'handsOn',
  'peopleFacing',
  'mathComfort',
  'labTolerance',
  'memorisation',
  'creativity',
  'structurePreference',
  'longTrainingTolerance',
] as const

export type PersonaDimension = (typeof PERSONA_DIMENSIONS)[number]
export type PersonaProfile = Record<PersonaDimension, number>

export type Course = {
  id: string
  name: string
  institution: string
  institutionShort: string
  faculty: string
  /** Indicative, prior-year. Never presented as this year's official figure. */
  utmeCutoff: number
  olevelRule: OLevelRule
  utmeRule: UtmeRule
  personaProfile: PersonaProfile
  /** One plain-language sentence describing the course. */
  blurb: string
  /** What the day-to-day of studying it actually looks like. */
  reality: string
  durationYears: number
}

/* -------------------------------------------------------------------------- */
/* Walkthroughs                                                                */
/* -------------------------------------------------------------------------- */

export const WALKTHROUGH_IDS = ['jamb', 'unilag-postutme'] as const
export type WalkthroughId = (typeof WALKTHROUGH_IDS)[number]

/**
 * A rectangle marking what to click, in PERCENTAGES of the screenshot box.
 * Percentages rather than pixels so a replaced screenshot at a different
 * resolution keeps its annotation without redrawing anything.
 */
export type Hotspot = { x: number; y: number; w: number; h: number }

export type WalkthroughStep = {
  id: string
  order: number
  title: string
  /** One sentence. What to do, not what the screen is. */
  instruction: string
  screenshotUrl: string
  hotspot: Hotspot | null
  /** Shown as "Most people get stuck here". Only where it is genuinely true. */
  tip: string | null
  /** Terms worth defining inline, the first time they appear. */
  defines?: { term: string; meaning: string }[]
}

export type Walkthrough = {
  id: WalkthroughId
  title: string
  description: string
  estimatedMinutes: number
  /** What the student should have ready before starting. */
  bringWithYou: string[]
  steps: WalkthroughStep[]
}

/* -------------------------------------------------------------------------- */
/* Tickets                                                                     */
/* -------------------------------------------------------------------------- */

export const TICKET_CATEGORIES = [
  'eligibility_dispute',
  'result_discrepancy',
  'course_change',
  'deadline',
  'registration_help',
  'other',
] as const

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  eligibility_dispute: "My result doesn't look right here",
  result_discrepancy: 'My result slip has an error',
  course_change: 'I want to change my course',
  deadline: "I've missed or am about to miss a deadline",
  registration_help: "I'm stuck registering",
  other: 'Something else',
}

export type TicketStatus = 'open' | 'assigned' | 'resolved'

export const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().min(4, 'Give your question a short title.').max(120),
  body: z.string().min(10, 'Tell us a little more so a counselor can help.').max(2000),
  courseId: z.string().optional(),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>
