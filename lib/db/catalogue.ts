import { asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { catalogueInstitutions, catalogueProgrammes } from '@/lib/db/schema'
import { SAMPLE_CATALOGUE_PROGRAMMES } from '@/lib/db/catalogue.data'
import { COURSES } from '@/lib/db/courses.data'
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

  // No database: the three reviewed courses, plus the sample IBASS-style rows.
  // Discovery searches the pair, so a Biology-and-Chemistry answer has a real
  // national spread to draw on even offline — but only the reviewed three can
  // ever lead anywhere except "go and confirm this in IBASS".
  return {
    source: 'sample',
    programmes: [
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
    ],
  }
}
