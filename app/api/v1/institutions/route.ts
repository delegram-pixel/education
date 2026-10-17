import { withApi } from '@/lib/api/handler'
import { paginate } from '@/lib/api/paging'
import { parseListParams } from '@/lib/api/params'
import { fail, ok } from '@/lib/api/respond'
import { institutionView } from '@/lib/api/views'
import { listInstitutions } from '@/lib/db/catalogue'
import { filterInstitutions } from '@/lib/institutions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Institutions, filtered and paged.
 *
 * The filtering is `filterInstitutions` — the same function the browse page
 * uses — rather than a query of this route's own, so the API and the app cannot
 * disagree about which schools are in Lagos. It runs in memory because the
 * institution list is a few hundred rows and arrives in one grouped query; the
 * twenty thousand rows behind it are counted in SQL, not read.
 */
export async function GET(request: Request) {
  return withApi(request, async ({ url }) => {
    const parsed = parseListParams(url.searchParams)
    if (!parsed.ok) return fail('bad_request', parsed.message)

    const { limit, offset, q, state, type, category } = parsed.value
    const { institutions, source } = await listInstitutions()

    const matched = filterInstitutions(institutions, {
      state: state ?? null,
      type: type ?? null,
      category: category ?? null,
      query: q,
    })

    const page = paginate(matched, offset, limit)

    return ok(page.page.map(institutionView), {
      source,
      pagination: { limit, nextCursor: page.nextCursor, total: page.total },
    })
  })
}
