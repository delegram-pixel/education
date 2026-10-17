import { withApi } from '@/lib/api/handler'
import { openApiDocument } from '@/lib/api/openapi'
import { ok } from '@/lib/api/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The contract, as an OpenAPI 3.1 document, for a client generator to read.
 *
 * Behind the same key as everything else. It is not a secret — it describes a
 * public catalogue — but serving it unauthenticated would make this the one
 * route a crawler could reach, and the document says nothing a caller with a key
 * does not already have.
 *
 * `servers` is built from the address the request arrived at, so a client
 * generated against a preview deployment points at the preview, and one
 * generated against production points at production. `APP_BASE_URL` overrides it
 * where the app is behind a proxy that rewrites the host.
 */
export async function GET(request: Request) {
  return withApi(request, async ({ baseUrl }) => ok(openApiDocument(baseUrl), { source: 'built-in' }))
}
