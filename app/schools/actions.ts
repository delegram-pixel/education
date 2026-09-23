'use server'

import { listProgrammesForInstitution } from '@/lib/db/catalogue'

/** One row of a school's programme list, reduced to what the card renders. */
export type InstitutionProgramme = {
  programme: string
  department: string | null
  utmeSubjects: string[]
  sourceUrl: string
  /** Non-null when the checker has reviewed this programme. */
  reviewedCourseId: string | null
}

export type InstitutionProgrammesState =
  | { status: 'error'; message: string }
  | { status: 'done'; programmes: InstitutionProgramme[]; source: 'ibass' | 'sample' }

/**
 * Load the programmes one institution lists.
 *
 * On demand rather than shipped with the page: the institution list runs to
 * hundreds of rows and each can carry dozens of programmes, so sending the whole
 * catalogue to the browser to render one school at a time would cost megabytes
 * to answer a question about one of them.
 *
 * Returns no verdict and cannot — see `lib/db/catalogue.ts`. A reviewed
 * programme carries the course id that links into the checker; everything else
 * carries its source URL and nothing more.
 */
export async function loadInstitutionProgrammes(
  name: string,
): Promise<InstitutionProgrammesState> {
  const trimmed = name.trim()
  if (!trimmed) return { status: 'error', message: 'Pick a school first.' }

  const { programmes, source } = await listProgrammesForInstitution(trimmed)

  return {
    status: 'done',
    source,
    programmes: programmes.map((programme) => ({
      programme: programme.programme,
      department: programme.department,
      utmeSubjects: programme.utmeSubjects,
      sourceUrl: programme.sourceUrl,
      reviewedCourseId: programme.reviewedCourseId ?? null,
    })),
  }
}
