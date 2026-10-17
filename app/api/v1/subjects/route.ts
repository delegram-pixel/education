import { withApi } from '@/lib/api/handler'
import { ok } from '@/lib/api/respond'
import { subjectVocabulary } from '@/lib/api/views'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The subject and grade vocabulary, so a client maps what a student types the
 * way this catalogue does.
 *
 * Served rather than documented because getting it wrong is silent. A client
 * that never learns `MTH` means Mathematics does not fail — it matches nothing —
 * and a client that infers its own grade table will treat a D7 as a credit, which
 * is the single mistake this codebase warns about more than any other. The grade
 * table here is `isCredit` from `lib/types.ts`, the same function the eligibility
 * engine decides with, so the vocabulary a client renders and the rule the
 * checker applies cannot come apart.
 *
 * `source` is `built-in`: this is compiled into the app, not mirrored from IBASS,
 * and saying otherwise would be a claim about JAMB's data that is not true.
 */
export async function GET(request: Request) {
  return withApi(request, async () => ok(subjectVocabulary(), { source: 'built-in' }))
}
