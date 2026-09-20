/**
 * Recognising subjects in free text.
 *
 * `lib/types.ts` owns the canonical subject list; this module owns the separate
 * problem of finding it in what a student actually types. Discovery matches on
 * `SubjectCode`s, never on raw text, so a spelling the dictionary does not know
 * can only ever fail to add a chip — it can never silently produce a wrong
 * match.
 *
 * Two entry points, for two different jobs:
 *   `normaliseSubject` — one label to one code, or null. Used for the subject
 *                        strings that come out of the IBASS catalogue.
 *   `parseSubjects`    — a whole sentence to codes. Used for the discovery box,
 *                        where a student types "Biology and Chemistry".
 */

import { SUBJECTS, type SubjectCode } from '@/lib/types'

/**
 * Lowercase, drop punctuation, collapse whitespace. `&` becomes `and` so that
 * "Food & Nutrition" and "Food and Nutrition" are the same key.
 */
function fold(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Spellings students actually type, over and above the canonical names in
 * `SUBJECTS`. Keys are folded, so they can be written the way a person would
 * say them.
 */
const RAW_ALIASES: Record<string, SubjectCode> = {
  // English
  english: 'ENG',
  'english language': 'ENG',
  'use of english': 'ENG',
  'use of english language': 'ENG',
  eng: 'ENG',
  // Mathematics
  mathematics: 'MTH',
  maths: 'MTH',
  math: 'MTH',
  'general mathematics': 'MTH',
  mth: 'MTH',
  // Biology
  biology: 'BIO',
  bio: 'BIO',
  // Chemistry
  chemistry: 'CHM',
  chem: 'CHM',
  chm: 'CHM',
  // Physics
  physics: 'PHY',
  phy: 'PHY',
  // Further Mathematics
  'further mathematics': 'FMA',
  'further maths': 'FMA',
  'further math': 'FMA',
  'f maths': 'FMA',
  fmaths: 'FMA',
  fma: 'FMA',
  // Agricultural Science
  'agricultural science': 'AGR',
  'agric science': 'AGR',
  agriculture: 'AGR',
  agric: 'AGR',
  agr: 'AGR',
  // Economics
  economics: 'ECO',
  econs: 'ECO',
  econ: 'ECO',
  eco: 'ECO',
  // Government
  government: 'GOV',
  govt: 'GOV',
  gov: 'GOV',
  // Commerce
  commerce: 'CMM',
  comm: 'CMM',
  cmm: 'CMM',
  // Financial Accounting
  'financial accounting': 'ACC',
  'financial accounts': 'ACC',
  accounting: 'ACC',
  accountancy: 'ACC',
  accounts: 'ACC',
  'f acc': 'ACC',
  facc: 'ACC',
  acc: 'ACC',
  // Geography
  geography: 'GEO',
  geog: 'GEO',
  geo: 'GEO',
  // Literature in English
  'literature in english': 'LIT',
  'literature in eng': 'LIT',
  literature: 'LIT',
  lit: 'LIT',
  // History
  history: 'HIS',
  hist: 'HIS',
  his: 'HIS',
  // Christian Religious Studies
  'christian religious studies': 'CRS',
  'christian religious knowledge': 'CRS',
  'christian religious education': 'CRS',
  'bible knowledge': 'CRS',
  crs: 'CRS',
  crk: 'CRS',
  // Islamic Religious Studies
  'islamic religious studies': 'IRS',
  'islamic religious knowledge': 'IRS',
  'islamic studies': 'IRS',
  irs: 'IRS',
  irk: 'IRS',
  // Civic Education
  'civic education': 'CVE',
  civic: 'CVE',
  civics: 'CVE',
  cve: 'CVE',
  // Technical Drawing
  'technical drawing': 'TCD',
  'tech drawing': 'TCD',
  'technical draw': 'TCD',
  tcd: 'TCD',
  // Food and Nutrition
  'food and nutrition': 'FDN',
  'food nutrition': 'FDN',
  'food and nutrition science': 'FDN',
  fdn: 'FDN',
  // Languages
  french: 'FRE',
  fre: 'FRE',
  yoruba: 'YOR',
  yor: 'YOR',
  igbo: 'IGB',
  igb: 'IGB',
  hausa: 'HAU',
  hau: 'HAU',
}

/** Folded label → code, canonical names included. */
const LOOKUP = new Map<string, SubjectCode>()

for (const [code, name] of Object.entries(SUBJECTS) as [SubjectCode, string][]) {
  LOOKUP.set(fold(name), code)
}
for (const [label, code] of Object.entries(RAW_ALIASES)) {
  LOOKUP.set(fold(label), code)
}

/**
 * Phrases to scan for, longest first.
 *
 * Longest-first is what makes "Further Mathematics" resolve to FMA rather than
 * leaving a stray MTH behind, and "Food and Nutrition" survive a scan that
 * would otherwise see only its parts.
 */
const PHRASES: { pattern: RegExp; code: SubjectCode }[] = [...LOOKUP.entries()]
  .sort(([a], [b]) => b.length - a.length)
  .map(([label, code]) => ({
    // Whole-word match, so "biology" never matches inside "microbiology".
    pattern: new RegExp(`(^| )${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?= |$)`),
    code,
  }))

/** One published subject label to one code, or null if we do not know it. */
export function normaliseSubject(input: string): SubjectCode | null {
  const key = fold(input)
  return key ? (LOOKUP.get(key) ?? null) : null
}

/**
 * A sentence of subjects to a deduped list of codes.
 *
 * Unknown words are ignored rather than reported: a student typing "Biology,
 * Chemistry, General Paper" should get their two real subjects matched, not an
 * error about the third. Output is ordered by `SUBJECTS`, so the same set of
 * subjects always produces the same chips in the same order.
 */
export function parseSubjects(input: string): SubjectCode[] {
  let remaining = fold(input)
  if (!remaining) return []

  const found = new Set<SubjectCode>()

  for (const { pattern, code } of PHRASES) {
    // Consume each phrase as it is found, so a later, shorter alias cannot
    // re-match the words an earlier one already claimed.
    while (pattern.test(remaining)) {
      found.add(code)
      remaining = remaining.replace(pattern, ' ')
    }
  }

  return (Object.keys(SUBJECTS) as SubjectCode[]).filter((code) => found.has(code))
}

/** The subjects a picker can offer, in canonical order. */
export function subjectOptions(): { code: SubjectCode; name: string }[] {
  return (Object.keys(SUBJECTS) as SubjectCode[]).map((code) => ({
    code,
    name: SUBJECTS[code],
  }))
}
