/**
 * Sample IBASS-style catalogue rows.
 *
 * WHY THESE EXIST: without `DATABASE_URL` the catalogue falls back to the three
 * hand-reviewed courses in `courses.data.ts`. Three programmes is a thin answer
 * to "what can I study with Biology and Chemistry", so discovery would look
 * broken in exactly the demo it is meant to carry. These rows give it a real
 * national spread to search.
 *
 * WHAT THEY ARE NOT: reviewed. Nothing here carries an eligibility rule, and
 * nothing here can produce a verdict — these rows never reach the engine, which
 * reads only `courses.data.ts`. They exist to be *discovered*, with a link to
 * IBASS and an invitation to go and confirm.
 *
 * They also deliberately omit the three reviewed UNILAG courses (Medicine &
 * Surgery, Computer Science, Accounting). Those arrive from `courses.data.ts`
 * already tagged with their course id, and duplicating them here would list each
 * of them twice.
 *
 * The shape mirrors what `scripts/sync-ibass-catalogue.ts` writes, so the real
 * mirror and this fallback render through exactly the same code path.
 */

import type { SwiftKnowledgeProgramme } from '@/lib/db/catalogue'

/** Where IBASS publishes the brochure these rows describe. */
const SOURCE_URL = 'https://ibass.jamb.gov.ng/brochure-by-institution'

/** Same timestamp the sample courses use — a clear "not a real import". */
const SAMPLE_DATE = new Date(0)

const UNVERIFIED = 'Unverified sample listing — confirm in the current JAMB IBASS brochure.'
const OLEVEL = 'Five credits including English and Mathematics (sample — confirm in IBASS).'

const UNILAG = 'University of Lagos'
const UI = 'University of Ibadan'
const OAU = 'Obafemi Awolowo University'

type Row = {
  institution: string
  programme: string
  department: string
  utmeSubjects: string[]
}

/**
 * Subject labels are written the way IBASS publishes them ("English Language",
 * not "ENG"), because that is what `normaliseSubject` is built to read and what
 * the student sees quoted back.
 */
const SCIENCE = ['English Language', 'Biology', 'Chemistry', 'Physics']
const ENGINEERING = ['English Language', 'Mathematics', 'Physics', 'Chemistry']

const ROWS: Row[] = [
  /* --- University of Lagos ------------------------------------------------ */
  { institution: UNILAG, programme: 'Nursing Science', department: 'Faculty of Clinical Sciences', utmeSubjects: SCIENCE },
  { institution: UNILAG, programme: 'Pharmacy', department: 'Faculty of Pharmacy', utmeSubjects: SCIENCE },
  { institution: UNILAG, programme: 'Biochemistry', department: 'Faculty of Science', utmeSubjects: SCIENCE },
  { institution: UNILAG, programme: 'Microbiology', department: 'Faculty of Science', utmeSubjects: SCIENCE },
  { institution: UNILAG, programme: 'Physiology', department: 'Faculty of Basic Medical Sciences', utmeSubjects: SCIENCE },
  {
    institution: UNILAG,
    programme: 'Nutrition and Dietetics',
    department: 'Faculty of Science',
    // No Physics — a Biology-and-Chemistry student should still land here.
    utmeSubjects: ['English Language', 'Biology', 'Chemistry', 'Food and Nutrition'],
  },
  { institution: UNILAG, programme: 'Mechanical Engineering', department: 'Faculty of Engineering', utmeSubjects: ENGINEERING },
  { institution: UNILAG, programme: 'Electrical & Electronics Engineering', department: 'Faculty of Engineering', utmeSubjects: ENGINEERING },
  { institution: UNILAG, programme: 'Architecture', department: 'Faculty of Environmental Sciences', utmeSubjects: [...ENGINEERING, 'Technical Drawing'] },
  { institution: UNILAG, programme: 'Economics', department: 'Faculty of Social Sciences', utmeSubjects: ['English Language', 'Mathematics', 'Economics', 'Government'] },
  { institution: UNILAG, programme: 'Business Administration', department: 'Faculty of Management Sciences', utmeSubjects: ['English Language', 'Mathematics', 'Economics', 'Commerce'] },
  { institution: UNILAG, programme: 'Mass Communication', department: 'Faculty of Social Sciences', utmeSubjects: ['English Language', 'Literature in English', 'Government', 'Economics'] },
  { institution: UNILAG, programme: 'Law', department: 'Faculty of Law', utmeSubjects: ['English Language', 'Literature in English', 'Government', 'Christian Religious Studies'] },
  { institution: UNILAG, programme: 'French', department: 'Faculty of Arts', utmeSubjects: ['English Language', 'French', 'Literature in English', 'Government'] },
  { institution: UNILAG, programme: 'Yoruba', department: 'Faculty of Arts', utmeSubjects: ['English Language', 'Yoruba', 'Literature in English', 'History'] },

  /* --- University of Ibadan ----------------------------------------------- */
  { institution: UI, programme: 'Medicine & Surgery', department: 'College of Medicine', utmeSubjects: SCIENCE },
  { institution: UI, programme: 'Nursing Science', department: 'Faculty of Clinical Sciences', utmeSubjects: SCIENCE },
  { institution: UI, programme: 'Dentistry', department: 'College of Medicine', utmeSubjects: SCIENCE },
  { institution: UI, programme: 'Botany', department: 'Faculty of Science', utmeSubjects: ['English Language', 'Biology', 'Chemistry', 'Geography'] },
  { institution: UI, programme: 'Zoology', department: 'Faculty of Science', utmeSubjects: ['English Language', 'Biology', 'Chemistry', 'Agricultural Science'] },
  { institution: UI, programme: 'Agricultural Economics', department: 'Faculty of Agriculture', utmeSubjects: ['English Language', 'Mathematics', 'Economics', 'Agricultural Science'] },
  { institution: UI, programme: 'Statistics', department: 'Faculty of Science', utmeSubjects: ['English Language', 'Mathematics', 'Economics', 'Geography'] },
  { institution: UI, programme: 'Law', department: 'Faculty of Law', utmeSubjects: ['English Language', 'Literature in English', 'Government', 'History'] },

  /* --- Obafemi Awolowo University ----------------------------------------- */
  { institution: OAU, programme: 'Medicine & Surgery', department: 'College of Health Sciences', utmeSubjects: SCIENCE },
  { institution: OAU, programme: 'Pharmacy', department: 'Faculty of Pharmacy', utmeSubjects: SCIENCE },
  { institution: OAU, programme: 'Medical Rehabilitation', department: 'College of Health Sciences', utmeSubjects: SCIENCE },
  { institution: OAU, programme: 'Computer Science', department: 'Faculty of Science', utmeSubjects: ['English Language', 'Mathematics', 'Physics', 'Further Mathematics'] },
  { institution: OAU, programme: 'Agricultural Engineering', department: 'Faculty of Technology', utmeSubjects: ENGINEERING },
  { institution: OAU, programme: 'Science Laboratory Technology', department: 'Faculty of Science', utmeSubjects: SCIENCE },
]

export const SAMPLE_CATALOGUE_PROGRAMMES: SwiftKnowledgeProgramme[] = ROWS.map((row) => ({
  institution: row.institution,
  programme: row.programme,
  department: row.department,
  status: 'Unverified — discovery listing only',
  utmeSubjects: row.utmeSubjects,
  olevelRequirements: OLEVEL,
  directEntryRequirements: null,
  remarks: UNVERIFIED,
  sourceUrl: SOURCE_URL,
  sourceUpdatedAt: SAMPLE_DATE,
  reviewedCourseId: null,
}))
