/**
 * The published contract for the catalogue API.
 *
 * One module records the version, the page limits, the rate limit and the error
 * codes, so the OpenAPI document served at `/api/v1/openapi.json`, the handlers
 * that enforce those numbers, and the prose shipped to integrators all read the same
 * values. A client integrating against any one of the three is integrating
 * against the same numbers, and a change to a limit lands in all of them at
 * once rather than in whichever copies somebody remembered.
 *
 * WHAT THIS API IS NOT — and the reason it is stated at the top of the contract
 * rather than buried in the docs: it never returns a verdict. It carries the
 * brochure's requirement prose with the URL it came from, and it hands out a
 * link into the checker where one exists. Only the in-app eligibility checker
 * may present a reviewed automated verdict; see `app/api/swift/knowledge/route.ts`
 * and `app/schools/actions.ts`, which say the same thing to the two other
 * consumers of this catalogue.
 */

/**
 * The version in the path, and the version echoed in every response.
 *
 * Bumped only for a breaking change to a field a client already reads. Adding a
 * field is not breaking and does not bump it, which is why the docs promise
 * additive change within a version rather than freezing the payload.
 */
export const API_VERSION = '1'

/** The path every endpoint below hangs off, version included. */
export const API_PATH = `/api/v${API_VERSION}`

/** Page size when a client does not ask for one. */
export const DEFAULT_PAGE_SIZE = 25

/**
 * The largest page this API will serve, whatever a client asks for.
 *
 * A client asking for more is clamped rather than refused, and the response
 * reports the limit it actually got. The catalogue runs past twenty thousand
 * programmes and every page is a database read — an uncapped `limit` is a way
 * for one caller to spend the whole quota, and clamping keeps a buggy client
 * working instead of failing it.
 */
export const MAX_PAGE_SIZE = 100

/**
 * Requests one key may make in one window.
 *
 * Deliberately generous: this exists to stop a runaway loop, not to meter a
 * partner. See `lib/api/rate-limit.ts` for why this is a floor rather than an
 * enforcement guarantee.
 */
export const RATE_LIMIT = { requests: 60, windowMs: 60_000 } as const

/**
 * Which catalogue answered a request. Not an error state — see the docs.
 *
 * `ibass` is the mirror; `sample` means the database was unreachable and the
 * built-in sample answered instead. `built-in` means the answer did not come from
 * the catalogue at all — the subject and grade vocabulary is compiled into the
 * app, not mirrored from anywhere, and reporting it as either of the other two
 * would be a claim about the catalogue that is not true.
 */
export type CatalogueSource = 'ibass' | 'sample' | 'built-in'

export const ERROR_CODES = [
  'unauthorized',
  'not_found',
  'bad_request',
  'rate_limited',
  'unavailable',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

/**
 * The status each code carries.
 *
 * Fixed here rather than chosen per call site, so `bad_request` cannot mean 400
 * on one route and 422 on another. A client switching on the code can rely on
 * the status, and a client switching on the status can rely on the code.
 */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  bad_request: 400,
  rate_limited: 429,
  unavailable: 503,
}

/**
 * Carried on every catalogue response.
 *
 * The same sentence the knowledge document opens with, for the same reason: a
 * client quoting this API back to a student is quoting a catalogue, and a
 * catalogue is not an offer. An integrator can render this without composing its own
 * wording, which is what stops the disclaimer drifting per integration.
 */
export const CATALOGUE_DISCLAIMER =
  "Catalogue presence is not an offer of admission, and a programme count is what this catalogue holds rather than what an institution offers. Requirements, fees and deadlines change each session — verify them in the current JAMB IBASS record and the institution's own bulletin."

/** One endpoint, as the contract and the OpenAPI document both describe it. */
export type EndpointSpec = {
  /** Path below `API_PATH`, with `{id}` for a path parameter. */
  path: string
  summary: string
  /** Query parameters accepted, in documentation order. */
  params: readonly string[]
}

/**
 * Every endpoint this API serves.
 *
 * The OpenAPI document is built from this list and a test asserts it matches the
 * routes on disk, so an endpoint cannot exist without being documented or be
 * documented without existing.
 */
export const ENDPOINTS: readonly EndpointSpec[] = [
  {
    path: '/meta',
    summary: 'Which catalogue answered, how large it is, and how fresh it is.',
    params: [],
  },
  {
    path: '/institutions',
    summary: 'Institutions in the catalogue, with how many programmes each lists.',
    params: ['state', 'type', 'category', 'q', 'limit', 'cursor'],
  },
  {
    path: '/institutions/{id}',
    summary: 'One institution, with its programmes paged.',
    params: ['limit', 'cursor'],
  },
  {
    path: '/programmes',
    summary: 'Programmes, with the UTME subjects and requirement prose IBASS publishes.',
    params: ['institutionId', 'state', 'q', 'subject', 'limit', 'cursor'],
  },
  {
    path: '/programmes/{id}',
    summary: 'One programme, with its full requirement prose, as the brochure wrote it.',
    params: [],
  },
  {
    path: '/subjects',
    summary: 'The subject codes this catalogue uses, and the grade table.',
    params: [],
  },
  {
    path: '/openapi.json',
    summary: 'This contract, as an OpenAPI 3.1 document.',
    params: [],
  },
] as const
