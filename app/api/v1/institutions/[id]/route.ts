import { withApi } from '@/lib/api/handler'
import { cursorFor } from '@/lib/api/paging'
import { parseListParams } from '@/lib/api/params'
import { fail, ok } from '@/lib/api/respond'
import { institutionView, programmeSummary } from '@/lib/api/views'
import { findInstitution, listProgrammes } from '@/lib/db/catalogue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * One institution, with its programmes paged.
 *
 * A 404 rather than an empty object when the id names nothing: the caller asked
 * about one record, and "here is nothing" and "there is no such school" are
 * different answers. The institution's own count travels in `data.institution`,
 * while `pagination.total` is the number of programmes in *this* response's
 * filter — which is the same number here, so a client can page either way.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return withApi(request, async ({ url }) => {
    const parsed = parseListParams(url.searchParams)
    if (!parsed.ok) return fail('bad_request', parsed.message)

    const { limit, offset } = parsed.value
    const { institution, source } = await findInstitution(id)

    if (!institution) {
      // The message names what was asked for, because the likely cause is an id
      // copied from somewhere else with its case or its punctuation changed.
      return fail(
        'not_found',
        `No institution in the catalogue has the id or name \`${id}\`. \`GET /institutions\` lists them.`,
      )
    }

    // Keyed on the row's own id rather than on what the caller passed, so a
    // lookup by name and a lookup by id return the same programmes.
    const { programmes, total } = await listProgrammes({
      institutionId: institution.id,
      limit,
      offset,
    })

    return ok(
      { institution: institutionView(institution), programmes: programmes.map(programmeSummary) },
      {
        source,
        pagination: {
          limit,
          nextCursor: cursorFor(offset, programmes.length, total),
          total,
        },
      },
    )
  })
}
