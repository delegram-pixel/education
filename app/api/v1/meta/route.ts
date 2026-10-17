import { CATALOGUE_DISCLAIMER } from '@/lib/api/contract'
import { withApi } from '@/lib/api/handler'
import { ok } from '@/lib/api/respond'
import { catalogueStats } from '@/lib/db/catalogue'

/**
 * `node:crypto` for the key comparison pins this to the Node runtime — see
 * `lib/api/auth.ts`. Explicit rather than assumed, because the default is a
 * framework setting and this is a correctness requirement.
 */
export const runtime = 'nodejs'

/**
 * Every response here is built for one caller: it carries that caller's rate
 * limit headers, and the key it was authenticated against decides which bucket
 * it came out of. Next's own route cache would hand one caller the other's.
 * `Cache-Control` is `private`, so the only cache allowed to store the response
 * is the caller's own client. A shared one keys on the URL, cannot tell an
 * authenticated request from an anonymous one, and would answer the latter.
 */
export const dynamic = 'force-dynamic'

/**
 * How large the catalogue is and how fresh, so a client can say "3,412
 * programmes across 466 institutions" rather than implying its first page is
 * everything.
 */
export async function GET(request: Request) {
  return withApi(request, async () => {
    const stats = await catalogueStats()

    return ok(
      {
        institutions: stats.institutions,
        programmes: stats.programmes,
        lastUpdatedAt: stats.lastUpdatedAt?.toISOString() ?? null,
        disclaimer: CATALOGUE_DISCLAIMER,
      },
      { source: stats.source },
    )
  })
}
