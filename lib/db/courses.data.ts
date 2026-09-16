/**
 * Course catalogue — sample data.
 *
 * SCOPE NOTE: three courses at one institution (University of Lagos). One
 * institution is a deliberate choice, not a shortcut — it means a single
 * POST-UTME walkthrough serves all three courses, which keeps the demo honest
 * about what has actually been built.
 *
 * DATA NOTE: these requirements follow the standard Nigerian pattern (five
 * credits including English and Mathematics, obtained in at most two sittings)
 * and reflect the widely published requirements for these courses. They have
 * NOT been verified against the current JAMB brochure or UNILAG bulletin, and
 * every entry below is marked accordingly. The UI surfaces this to the user as
 * sample data; do not remove that label. Real students may act on this.
 *
 * This file is also the offline fallback: when Neon is unreachable the app
 * reads from here, so the core eligibility flow never depends on a network.
 */

import type { Course } from '@/lib/types'

const UNILAG = {
  institution: 'University of Lagos',
  institutionShort: 'UNILAG',
} as const

export const COURSES: Course[] = [
  {
    id: 'medicine-unilag',
    name: 'Medicine & Surgery',
    ...UNILAG,
    faculty: 'College of Medicine',
    durationYears: 6,
    utmeCutoff: 280, // unverified — indicative, prior-year departmental mark
    blurb:
      'Train as a medical doctor. Six years, heavily science-based, with hospital placements from the third year.',
    reality:
      'Expect long contact hours, continuous assessment, and a great deal of memorisation. Most of the week is lectures, labs and, later on, ward rounds.',
    olevelRule: {
      // unverified — standard five-credit science requirement
      minCredits: 5,
      mandatory: ['ENG', 'MTH', 'BIO', 'CHM', 'PHY'],
      maxSittings: 2,
    },
    utmeRule: {
      compulsory: ['ENG'],
      chooseFrom: ['BIO', 'CHM', 'PHY'],
      choose: 3,
    },
    personaProfile: {
      handsOn: 70,
      peopleFacing: 88,
      mathComfort: 45,
      labTolerance: 92,
      memorisation: 95,
      creativity: 30,
      structurePreference: 80,
      longTrainingTolerance: 96,
    },
  },
  {
    id: 'computer-science-unilag',
    name: 'Computer Science',
    ...UNILAG,
    faculty: 'Faculty of Science',
    durationYears: 4,
    utmeCutoff: 230, // unverified — indicative, prior-year departmental mark
    blurb:
      'Study how software and computing systems are built — programming, algorithms, data and networks.',
    reality:
      'Mathematical at the core, and much of the real work is solo problem-solving at a keyboard. Less lab-bench work than the other sciences.',
    olevelRule: {
      // unverified — standard requirement: English, Maths, Physics + two others
      minCredits: 5,
      mandatory: ['ENG', 'MTH', 'PHY'],
      anyOf: [
        {
          subjects: ['CHM', 'BIO', 'FMA', 'ECO', 'GEO', 'AGR', 'TCD'],
          count: 2,
          label: 'science or quantitative subjects',
        },
      ],
      maxSittings: 2,
    },
    utmeRule: {
      compulsory: ['ENG'],
      chooseFrom: ['MTH', 'PHY', 'CHM'],
      choose: 3,
    },
    personaProfile: {
      handsOn: 76,
      peopleFacing: 34,
      mathComfort: 88,
      labTolerance: 34,
      memorisation: 38,
      creativity: 82,
      structurePreference: 52,
      longTrainingTolerance: 48,
    },
  },
  {
    id: 'accounting-unilag',
    name: 'Accounting',
    ...UNILAG,
    faculty: 'Faculty of Management Sciences',
    durationYears: 4,
    utmeCutoff: 230, // unverified — indicative, prior-year departmental mark
    blurb:
      'Learn how organisations record, report and audit money — the groundwork for a professional accounting career.',
    reality:
      'Structured, rule-heavy and detail-driven. Strong on arithmetic and standards, light on laboratory work of any kind.',
    olevelRule: {
      // unverified — standard requirement: English, Maths, Economics + two others
      minCredits: 5,
      mandatory: ['ENG', 'MTH', 'ECO'],
      anyOf: [
        {
          subjects: ['GOV', 'CMM', 'ACC', 'GEO', 'LIT', 'HIS', 'CRS', 'IRS'],
          count: 2,
          label: 'commercial or arts subjects',
        },
      ],
      maxSittings: 2,
    },
    utmeRule: {
      compulsory: ['ENG'],
      chooseFrom: ['MTH', 'ECO', 'GOV'],
      choose: 3,
    },
    personaProfile: {
      handsOn: 28,
      peopleFacing: 56,
      mathComfort: 72,
      labTolerance: 14,
      memorisation: 66,
      creativity: 24,
      structurePreference: 92,
      longTrainingTolerance: 44,
    },
  },
]

export function getCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id)
}
