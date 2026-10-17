import { withApi } from '@/lib/api/handler'
import { cursorFor } from '@/lib/api/paging'
import { parseListParams } from '@/lib/api/params'
import { fail, ok } from '@/lib/api/respond'
import { programmeSummary } from '@/lib/api/views'
import { listProgrammes } from '@/lib/db/catalogue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Programmes, filtered and paged.
 *
 * Unlike `/institutions`, the filtering and the paging both happen in SQL. The
 * institution list is a few hundred rows; this one is past twenty thousand, and
 * answering "nursing in Lagos" by reading the national catalogue and filtering it
 * in memory would transfer the whole thing on every request to render thirty
 * rows.
 *
 * No requirement prose in a listing — see `programmeSummary`. A client that is
 * about to quote a programme fetches `/programmes/{id}` for it, which is one
 * request rather than fifteen kilobytes per row across a page of thirty.
 */
export async function GET(request: Request) {
  return withApi(request, async ({ url }) => {
    const parsed = parseListParams(url.searchParams)
    if (!parsed.ok) return fail('bad_request', parsed.message)

    const { limit, offset, q, state, institutionId, subject } = parsed.value

    const { programmes, source, total } = await listProgrammes({
      institutionId,
      state,
      // An empty `q` is "no search", not "search for nothing" — `parseListParams`
      // already trims, so this only turns the empty string back into an absence.
      q: q || undefined,
      subject,
      limit,
      offset,
    })

    return ok(programmes.map(programmeSummary), {
      source,
      pagination: {
        limit,
        nextCursor: cursorFor(offset, programmes.length, total),
        total,
      },
    })
  })
}
