import { withApi } from '@/lib/api/handler'
import { fail, ok } from '@/lib/api/respond'
import { programmeDetail } from '@/lib/api/views'
import { findProgrammeById, resolveReviewedCourses } from '@/lib/db/catalogue'
import { listCourses } from '@/lib/db/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * One programme, with the brochure's requirement prose and its source URL.
 *
 * The only endpoint that returns the prose, and the only one that needs to. The
 * prose is the brochure's own words, quoted — this route does not read them into
 * a decision, and `checkerUrl` is how it offers the decision instead.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return withApi(request, async ({ baseUrl }) => {
    const { programme, source } = await findProgrammeById(id)

    if (!programme) {
      return fail(
        'not_found',
        `No programme in the catalogue has the id \`${id}\`. \`GET /programmes\` lists them, and ids look like \`unilag:1042\`.`,
      )
    }

    // The same resolution every other view of a programme uses, so this endpoint
    // offers the checker exactly where the app does and nowhere else. The
    // fallback is unreachable — `resolveReviewedCourses` maps one row to one row
    // — but it keeps the row itself as the answer rather than dropping to an
    // error if that ever stops being true.
    const { data: courses } = await listCourses()
    const resolved = resolveReviewedCourses([programme], courses)[0] ?? programme

    return ok(programmeDetail(resolved, baseUrl), { source })
  })
}
