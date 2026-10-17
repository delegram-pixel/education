import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { API_PATH, ENDPOINTS, ERROR_CODES, ERROR_STATUS } from './contract'
import { openApiDocument } from './openapi'

const here = fileURLToPath(new URL('.', import.meta.url))
const routesDir = join(here, '..', '..', 'app', 'api', 'v1')

/** `/institutions/{id}` → `institutions/[id]/route.ts` */
function routeFile(path: string): string {
  return join(routesDir, ...path.replace(/^\//, '').replace(/\{id\}/g, '[id]').split('/'), 'route.ts')
}

/** Every directory under `app/api/v1`, with `[id]` put back to `{id}`. */
function routesOnDisk(): string[] {
  return readdirSync(routesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(join(routesDir, entry.name, 'route.ts')))
    .map((entry) => `/${entry.name.replace(/\[id\]/g, '{id}')}`)
}

describe('the contract and the routes on disk', () => {
  // The document is generated from this list and shipped to a partner. An
  // endpoint in one and not the other is either a promise we do not keep or a
  // route nobody can find.
  it('describes every route that exists', () => {
    for (const path of routesOnDisk()) {
      expect(ENDPOINTS.map((endpoint) => endpoint.path)).toContain(path)
    }
  })

  it('has a route for every path it describes', () => {
    for (const endpoint of ENDPOINTS) {
      expect(existsSync(routeFile(endpoint.path)), `${endpoint.path} has no route handler`).toBe(true)
    }
  })

  // The literal, not `/api/${API_VERSION}`: the routes live under `app/api/v1`.
  // Deriving the expectation from the same expression as the constant is how
  // `/api/1` shipped with a green suite — and every client generated from that
  // document would have called a path that does not exist.
  it('hangs every path off the versioned base', () => {
    expect(API_PATH).toBe('/api/v1')
  })

  it('gives every endpoint a summary and a params list', () => {
    for (const endpoint of ENDPOINTS) {
      expect(endpoint.summary.length, endpoint.path).toBeGreaterThan(0)
      expect(Array.isArray(endpoint.params), endpoint.path).toBe(true)
    }
  })

  it('lists no path twice', () => {
    const paths = ENDPOINTS.map((endpoint) => endpoint.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('the error contract', () => {
  it('has a status for every code, and none for anything else', () => {
    expect(Object.keys(ERROR_STATUS).sort()).toEqual([...ERROR_CODES].sort())
  })

  it('uses a status per code that no other code claims', () => {
    const statuses = ERROR_CODES.map((code) => ERROR_STATUS[code])
    expect(new Set(statuses).size).toBe(statuses.length)
  })
})

describe('the OpenAPI document', () => {
  const document = openApiDocument('https://app.example') as Record<string, any>

  it('is OpenAPI 3.1', () => {
    expect(document.openapi).toMatch(/^3\.1\./)
  })

  it('describes exactly the endpoints the contract lists, and no others', () => {
    expect(Object.keys(document.paths).sort()).toEqual(ENDPOINTS.map((e) => e.path).sort())
  })

  it('hangs its server off the versioned base, on the address it was given', () => {
    expect(document.servers[0].url).toBe(`https://app.example${API_PATH}`)
  })

  it('falls back to a relative server when the address is unknown', () => {
    const relative = openApiDocument(null) as Record<string, any>
    expect(relative.servers[0].url).toBe(API_PATH)
  })

  // A generated client builds a request per parameter, so a name in the contract
  // with no description in the document is a parameter their developers cannot
  // look up.
  it('documents every parameter the contract names', () => {
    for (const endpoint of ENDPOINTS) {
      const operation = document.paths[endpoint.path].get
      const documented = operation.parameters.map((parameter: any) => parameter.name)
      const expected = [...(endpoint.path.includes('{id}') ? ['id'] : []), ...endpoint.params]

      expect(documented.sort(), endpoint.path).toEqual([...expected].sort())
    }
  })

  it('documents a failure for every code the API can return', () => {
    for (const path of Object.keys(document.paths)) {
      const responses = document.paths[path].get.responses

      expect(responses['200'], path).toBeDefined()
      // 404 and 400 are per-endpoint — the ones with an id, and the ones with a
      // filter — but nothing may go undocumented, because a client generator
      // turns an undocumented response into an unhandled one.
      for (const code of ['unauthorized', 'rate_limited', 'unavailable'] as const) {
        expect(responses[String(ERROR_STATUS[code])], `${path} → ${code}`).toBeDefined()
      }
    }
  })

  it('marks the two credentials a client may present', () => {
    expect(Object.keys(document.components.securitySchemes).sort()).toEqual(['apiKeyAuth', 'bearerAuth'])
    expect(document.security).toEqual([{ bearerAuth: [] }, { apiKeyAuth: [] }])
  })

  it('names every schema it references', () => {
    const schemas = document.components.schemas as Record<string, unknown>
    for (const name of ['Institution', 'ProgrammeSummary', 'ProgrammeDetail', 'Meta', 'Pagination', 'Error']) {
      expect(schemas[name], name).toBeDefined()
    }
  })

  // Both directions, because both failures are silent. A `$ref` that names
  // nothing is a document a generator turns into a type pointing at no
  // definition; a schema in `components` that nothing points at is a shape a
  // reader has to reconcile against the paths by hand, and one a linter reports.
  it('resolves every reference it makes, and points at every schema it defines', () => {
    const schemas = document.components.schemas as Record<string, unknown>
    const referenced = [
      ...JSON.stringify(document.paths).matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g),
    ].map((match) => match[1]!)

    expect(referenced.length).toBeGreaterThan(0)

    for (const name of referenced) {
      expect(schemas[name], `${name} is referenced by a path but not defined`).toBeDefined()
    }

    for (const name of Object.keys(schemas)) {
      expect(referenced, `${name} is defined but no path points at it`).toContain(name)
    }
  })

  // A tag nothing uses renders as an empty heading in a generated reference,
  // which reads as a section that failed to load; an operation naming a tag the
  // document does not declare is dropped into an untitled group instead.
  it('files every operation under a declared tag, and leaves no tag empty', () => {
    const declared = (document.tags as { name: string }[]).map((tag) => tag.name)
    const used = Object.values(document.paths as Record<string, { get: { tags: string[] } }>).flatMap(
      (path) => path.get.tags,
    )

    expect(used.length).toBeGreaterThan(0)

    for (const tag of used) {
      expect(declared, `${tag} is used by an operation but not declared`).toContain(tag)
    }

    for (const tag of declared) {
      expect(used, `${tag} is declared but no operation uses it`).toContain(tag)
    }
  })

  it('carries the disclaimer, so a client need not compose one', () => {
    expect(document.info.description).toContain('not an offer of admission')
  })

  // It must be the same document for every caller, or a cache would hand one
  // deployment's server list to another.
  it('is the same document every time', () => {
    expect(JSON.stringify(openApiDocument('https://app.example'))).toBe(JSON.stringify(document))
  })
})
