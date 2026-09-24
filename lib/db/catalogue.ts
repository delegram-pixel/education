import { asc, count, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { SAMPLE_CATALOGUE_PROGRAMMES, SAMPLE_INSTITUTION_DETAILS } from '@/lib/db/catalogue.data'
import { COURSES } from '@/lib/db/courses.data'
import { listCourses } from '@/lib/db/queries'
import { catalogueInstitutions, catalogueProgrammes, programmeRules } from '@/lib/db/schema'
import { nameKey, reviewedCourseIndex } from '@/lib/discovery'
import { subjectName, type ProgrammeRuleStatus } from '@/lib/types'

export type SwiftKnowledgeProgramme = {
  institution: string
  programme: string
  department: string | null
  status: string | null
  utmeSubjects: string[]
  /**
   * The brochure's prose for this programme, present only on a read that asked
   * for it — see `PROSE_COLUMNS`. Absent, not null, when it was not read.
   */
  olevelRequirements?: string | null
  directEntryRequirements?: string | null
  remarks?: string | null
  sourceUrl: string
  sourceUpdatedAt: Date
  /**
   * The reviewed course this row is backed by, when there is one.
   *
   * Set only on the sample rows built from `courses.data.ts`. A mirrored IBASS
   * row leaves it null and is joined to a reviewed course by name instead — see
   * `matchProgrammes`. Non-null here is what entitles discovery to offer a link
   * into the checker rather than only "go and read the brochure".
   */
  reviewedCourseId?: string | null
  /**
   * The mirror's own identifier for this row — `<institutionId>:<programmeId>`.
   *
   * Null on the sample rows, which are reviewed courses and are reached by their
   * course id. A mirrored row needs this because it is what a rule is stored
   * against and what `/check?course=` resolves.
   */
  programmeId?: string | null
  /**
   * Whether a rule has already been read for this programme.
   *
   * Null when nobody has read one yet, which is the picker's cue to go and read
   * it. Distinct from `'no-source'`, which means the reading was done and the
   * brochure had nothing to say — a programme in that state is settled and must
   * not be re-read on every selection.
   */
  ruleStatus?: ProgrammeRuleStatus | null
}

/**
 * An institution in the discovery catalogue.
 *
 * Deliberately not a `Course`: this is a place programmes are listed under, not
 * something the eligibility engine can decide on. `programmeCount` is what the
 * catalogue currently holds, which is not a claim about what the school offers.
 */
export type CatalogueInstitution = {
  /** JAMB's identifier when mirrored; derived from the name for sample rows. */
  id: string
  name: string
  institutionType: string | null
  category: string | null
  state: string | null
  programmeCount: number
  sourceUrl: string
  sourceUpdatedAt: Date
}

/**
 * The no-database catalogue: the reviewed courses plus the sample IBASS-style
 * rows.
 *
 * Assembled here rather than inline so the programme list and the institution
 * list below are built from one array and cannot disagree about who is in the
 * catalogue or how many programmes each of them lists.
 */
function sampleProgrammes(): SwiftKnowledgeProgramme[] {
  return [
    ...COURSES.map((course) => ({
      institution: course.institution,
      programme: course.name,
      department: course.faculty,
      status: 'sample — reviewed by Admission Copilot',
      // Published as names, not codes: this document is read by a crawler and
      // quoted back to students, and "ENG, MTH, BIO" is neither.
      utmeSubjects: [...course.utmeRule.compulsory, ...course.utmeRule.chooseFrom].map(subjectName),
      olevelRequirements: `${course.olevelRule.minCredits} credits including ${course.olevelRule.mandatory
        .map(subjectName)
        .join(', ')}`,
      directEntryRequirements: null,
      remarks: 'Use the institution bulletin and JAMB IBASS to confirm the current session.',
      sourceUrl: 'https://ibass.jamb.gov.ng/brochure-by-institution',
      sourceUpdatedAt: new Date(0),
      reviewedCourseId: course.id,
    })),
    ...SAMPLE_CATALOGUE_PROGRAMMES,
  ]
}

/** Stable key for an institution the mirror gave us no identifier for. */
function institutionSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function sampleInstitutions(programmes: SwiftKnowledgeProgramme[]): CatalogueInstitution[] {
  const byName = new Map<string, CatalogueInstitution>()

  for (const programme of programmes) {
    const existing = byName.get(programme.institution)
    if (existing) {
      existing.programmeCount += 1
      continue
    }

    const details = SAMPLE_INSTITUTION_DETAILS[programme.institution]

    byName.set(programme.institution, {
      id: institutionSlug(programme.institution),
      name: programme.institution,
      institutionType: details?.institutionType ?? null,
      category: null,
      state: details?.state ?? null,
      programmeCount: 1,
      sourceUrl: programme.sourceUrl,
      sourceUpdatedAt: programme.sourceUpdatedAt,
    })
  }

  return [...byName.values()]
}

/**
 * The columns a listing needs, and the only ones most callers may have.
 *
 * Deliberately excludes the brochure prose in `PROSE_COLUMNS` below. Every read
 * that goes through here is one a student is waiting on, and the prose is by far
 * the largest thing in a catalogue row — so the cheap read is the default and
 * asking for more is something a caller has to say out loud.
 */
const LISTING_COLUMNS = {
  id: catalogueProgrammes.id,
  institution: catalogueInstitutions.name,
  programme: catalogueProgrammes.name,
  department: catalogueProgrammes.department,
  status: catalogueProgrammes.status,
  utmeSubjects: catalogueProgrammes.utmeSubjects,
  sourceUrl: catalogueProgrammes.sourceUrl,
  sourceUpdatedAt: catalogueProgrammes.sourceUpdatedAt,
  ruleStatus: programmeRules.status,
} as const

/** The brochure prose for one programme, as mirrored. */
type ProgrammeProse = {
  olevelRequirements: string | null
  directEntryRequirements: string | null
  remarks: string | null
}

/**
 * The brochure's own prose for a programme, exactly as mirrored.
 *
 * Word-generated HTML at roughly 15KB a programme — an order of magnitude more
 * than every other column in the row combined. Exactly one caller renders it:
 * the Swift knowledge document, which is a cached crawler endpoint rather than
 * anything a student waits on.
 *
 * WHY THIS IS NOT PART OF THE LISTING READ: selecting it for a school's
 * programme list meant one click on the school picker transferred megabytes the
 * picker never looks at — `InstitutionProgramme` carries none of these three
 * fields — and a transfer that size on a slow connection is killed before it
 * finishes, which is how a listing became a forty-second request that ended in
 * the static fallback. Reading a column nobody renders is not free; it is paid
 * for by whoever is waiting.
 */
const PROSE_COLUMNS = {
  olevelRequirements: catalogueProgrammes.olevelRequirements,
  directEntryRequirements: catalogueProgrammes.directEntryRequirements,
  remarks: catalogueProgrammes.remarks,
} as const satisfies Record<keyof ProgrammeProse, unknown>

/**
 * Read programme rows, optionally narrowed to a single institution.
 *
 * One reader rather than two, so the column list, the join and the sample
 * fallback exist once and cannot drift apart between the whole-catalogue view
 * and the per-institution one.
 *
 * The narrowing happens in SQL. The national catalogue runs past twelve thousand
 * programmes, and pulling every one of them across the wire to render a single
 * school's thirty is the kind of mistake that costs nothing at three sample rows
 * and a great deal at full size.
 */
async function readProgrammes(
  options: {
    /** Narrow to one institution, by the name IBASS publishes for it. */
    institutionName?: string
    /**
     * Also read the brochure prose. False unless a caller renders it — see
     * `PROSE_COLUMNS`, which is the whole case for this flag existing.
     */
    prose?: boolean
  } = {},
): Promise<{
  programmes: SwiftKnowledgeProgramme[]
  source: 'ibass' | 'sample'
}> {
  const { institutionName, prose = false } = options

  if (db) {
    try {
      const rows = await db
        .select(LISTING_COLUMNS)
        .from(catalogueProgrammes)
        .innerJoin(catalogueInstitutions, eq(catalogueProgrammes.institutionId, catalogueInstitutions.id))
        // LEFT, because the ordinary case is a programme nobody has read a rule
        // for yet. An inner join would hide every programme the picker most needs
        // to offer — the ones a read could still open up.
        .leftJoin(programmeRules, eq(programmeRules.programmeId, catalogueProgrammes.id))
        .where(institutionName ? eq(catalogueInstitutions.name, institutionName) : undefined)
        .orderBy(asc(catalogueInstitutions.name), asc(catalogueProgrammes.name))

      // An empty result means opposite things in the two cases. Across the whole
      // catalogue it means the mirror holds nothing and the sample rows are the
      // honest answer. For one institution it means the mirror is fine and this
      // school simply has no programme detail in it — so it is returned as IBASS
      // and left empty, rather than papered over with sample rows that would
      // credit us with knowing something we do not.
      if (rows.length || institutionName) {
        const proseById = prose ? await readProse(institutionName) : null

        return {
          source: 'ibass',
          programmes: rows.map(({ id, ruleStatus, ...row }) => {
            const detail = proseById?.get(id)

            return {
              ...row,
              programmeId: id,
              ruleStatus: ruleStatus ?? null,
              olevelRequirements: detail?.olevelRequirements,
              directEntryRequirements: detail?.directEntryRequirements,
              remarks: detail?.remarks,
            }
          }),
        }
      }
    } catch (error) {
      console.warn('[catalogue] Could not read IBASS mirror:', error)
    }
  }

  const sample = sampleProgrammes()
  return {
    source: 'sample',
    programmes: institutionName
      ? sample.filter((programme) => programme.institution === institutionName)
      : sample,
  }
}

/**
 * The brochure prose for a read that renders it, keyed by programme id.
 *
 * A second query rather than three more columns on the listing read, so that a
 * read which never shows the prose never transfers it. It is the same table, the
 * same join and the same filter as `readProgrammes`, which is what stops the two
 * disagreeing about which programmes exist.
 */
async function readProse(institutionName?: string): Promise<Map<string, ProgrammeProse>> {
  const rows = await db!
    .select({ id: catalogueProgrammes.id, ...PROSE_COLUMNS })
    .from(catalogueProgrammes)
    .innerJoin(catalogueInstitutions, eq(catalogueProgrammes.institutionId, catalogueInstitutions.id))
    .where(institutionName ? eq(catalogueInstitutions.name, institutionName) : undefined)

  return new Map(rows.map((row) => [row.id, row] as const))
}

/**
 * The document Swift indexes. It never silently turns a national catalogue row
 * into an automated decision: that remains limited to reviewed `courses`.
 *
 * `prose` is off by default for the same reason it is off in `readProgrammes`:
 * subject discovery reads this whole document on every search and renders none
 * of the prose, so paying for it there would buy nothing. The knowledge document
 * renders it and asks for it.
 */
export async function listSwiftKnowledgeProgrammes(
  options: { prose?: boolean } = {},
): Promise<{
  programmes: SwiftKnowledgeProgramme[]
  source: 'ibass' | 'sample'
}> {
  return readProgrammes(options)
}

/**
 * Every institution in the catalogue, with how many programmes it currently
 * lists.
 *
 * Read separately from the programme list because an institution is a thing a
 * student searches by — "which schools are in Lagos?" — and a list of programme
 * rows cannot answer it. An institution with no programmes at all still exists,
 * which is why the join below is a LEFT join: an inner one would hide exactly
 * the schools the mirror knows about but has no programme detail for.
 */
export async function listInstitutions(): Promise<{
  institutions: CatalogueInstitution[]
  source: 'ibass' | 'sample'
}> {
  if (db) {
    try {
      const rows = await db
        .select({
          id: catalogueInstitutions.id,
          name: catalogueInstitutions.name,
          institutionType: catalogueInstitutions.institutionType,
          category: catalogueInstitutions.category,
          state: catalogueInstitutions.state,
          sourceUrl: catalogueInstitutions.sourceUrl,
          sourceUpdatedAt: catalogueInstitutions.sourceUpdatedAt,
          programmeCount: count(catalogueProgrammes.id),
        })
        .from(catalogueInstitutions)
        .leftJoin(
          catalogueProgrammes,
          eq(catalogueProgrammes.institutionId, catalogueInstitutions.id),
        )
        .groupBy(catalogueInstitutions.id)
        // NULL states sort last under ASC, so unrecorded ones land at the end
        // rather than in front of Lagos.
        .orderBy(asc(catalogueInstitutions.state), asc(catalogueInstitutions.name))

      if (rows.length) return { institutions: rows, source: 'ibass' }
    } catch (error) {
      console.warn('[catalogue] Could not read IBASS institutions:', error)
    }
  }

  return { source: 'sample', institutions: sampleInstitutions(sampleProgrammes()) }
}

/**
 * The programmes the catalogue lists under one institution.
 *
 * Matched on the institution's name rather than its id: only a mirrored row
 * carries JAMB's identifier, so a sample row we wrote ourselves would be
 * unreachable by id and the offline path would show every school as empty. Names
 * in the brochure are the institution's own and distinguish branches, so this
 * holds on both paths. The match is applied in SQL by `readProgrammes`, not by
 * filtering a whole-catalogue read in memory.
 *
 * Reviewed courses are resolved here the same way the subject search resolves
 * them, via the shared index, so a programme offers a link into the checker in
 * both views or in neither.
 */
export async function listProgrammesForInstitution(institutionName: string): Promise<{
  programmes: SwiftKnowledgeProgramme[]
  source: 'ibass' | 'sample'
}> {
  const [{ programmes, source }, { data: courses }] = await Promise.all([
    readProgrammes({ institutionName }),
    listCourses(),
  ])

  const reviewed = reviewedCourseIndex(courses)

  return {
    source,
    programmes: programmes.map((programme) => ({
      ...programme,
      reviewedCourseId:
        programme.reviewedCourseId ??
        reviewed.get(`${nameKey(programme.institution)}|${nameKey(programme.programme)}`) ??
        null,
    })),
  }
}
