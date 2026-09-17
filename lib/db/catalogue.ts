import { asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { catalogueInstitutions, catalogueProgrammes } from '@/lib/db/schema'
import { COURSES } from '@/lib/db/courses.data'

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

  return {
    source: 'sample',
    programmes: COURSES.map((course) => ({
      institution: course.institution,
      programme: course.name,
      department: course.faculty,
      status: 'sample — reviewed by Admission Copilot',
      utmeSubjects: [...course.utmeRule.compulsory, ...course.utmeRule.chooseFrom],
      olevelRequirements: `${course.olevelRule.minCredits} credits including ${course.olevelRule.mandatory.join(', ')}`,
      directEntryRequirements: null,
      remarks: 'Use the institution bulletin and JAMB IBASS to confirm the current session.',
      sourceUrl: 'https://ibass.jamb.gov.ng/brochure-by-institution',
      sourceUpdatedAt: new Date(0),
    })),
  }
}
