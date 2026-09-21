import { asc, count, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { SAMPLE_CATALOGUE_PROGRAMMES, SAMPLE_INSTITUTION_DETAILS } from '@/lib/db/catalogue.data'
import { COURSES } from '@/lib/db/courses.data'
import { listCourses } from '@/lib/db/queries'
import { catalogueInstitutions, catalogueProgrammes } from '@/lib/db/schema'
import { nameKey, reviewedCourseIndex } from '@/lib/discovery'
import { subjectName } from '@/lib/types'

export type SwiftKnowledgeProgramme = {
  institution: string
  programme: string
  department: string | null
  status: string | null
  utmeSubjects: string[]
  olevelRequirements: string | null
  directEntryRequirements: string | null
  remarks: string | null
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
 * The document Swift indexes. It never silently turns a national catalogue row
 * into an automated decision: that remains limited to reviewed `courses`.
 */
export async function listSwiftKnowledgeProgrammes(): Promise<{
  programmes: SwiftKnowledgeProgramme[]
  source: 'ibass' | 'sample'
}> {
  if (db) {
    try {
      const rows = await db
        .select({
          institution: catalogueInstitutions.name,
          programme: catalogueProgrammes.name,
          department: catalogueProgrammes.department,
          status: catalogueProgrammes.status,
          utmeSubjects: catalogueProgrammes.utmeSubjects,
          olevelRequirements: catalogueProgrammes.olevelRequirements,
          directEntryRequirements: catalogueProgrammes.directEntryRequirements,
          remarks: catalogueProgrammes.remarks,
          sourceUrl: catalogueProgrammes.sourceUrl,
          sourceUpdatedAt: catalogueProgrammes.sourceUpdatedAt,
        })
        .from(catalogueProgrammes)
        .innerJoin(catalogueInstitutions, eq(catalogueProgrammes.institutionId, catalogueInstitutions.id))
        .orderBy(asc(catalogueInstitutions.name), asc(catalogueProgrammes.name))

      if (rows.length) return { programmes: rows, source: 'ibass' }
    } catch (error) {
      console.warn('[catalogue] Could not read IBASS mirror:', error)
    }
  }

  return { source: 'sample', programmes: sampleProgrammes() }
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
 * holds on both paths.
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
    listSwiftKnowledgeProgrammes(),
    listCourses(),
  ])

  const reviewed = reviewedCourseIndex(courses)
  const wanted = programmes.filter((programme) => programme.institution === institutionName)

  return {
    source,
    programmes: wanted.map((programme) => ({
      ...programme,
      reviewedCourseId:
        programme.reviewedCourseId ??
        reviewed.get(`${nameKey(programme.institution)}|${nameKey(programme.programme)}`) ??
        null,
    })),
  }
}
