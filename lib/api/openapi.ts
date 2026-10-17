/**
 * The OpenAPI 3.1 document, served at `/api/v1/openapi.json`.
 *
 * Built from `contract.ts` rather than written out, so the document, the handlers
 * and the prose cannot disagree about a limit or an error code. The paths come
 * from `ENDPOINTS`; the numbers come from the constants; the entity schemas are
 * derived from the types in `views.ts` by hand, because a type cannot describe
 * itself and a hand-written schema that drifts is worse than none.
 *
 * WHY IT EXISTS: Swift's engineers asked for an API to build against. A document
 * they can generate a typed client from is a shorter path to a working
 * integration — and a wrong one on our side — than a page of prose they
 * transcribe into request builders.
 *
 * It is a plain object, not a JSON string, so a test can walk it and the route
 * can serialise it. Nothing here reads the environment except `baseUrl`, which is
 * passed in: the document must be identical for every caller, or a cache would
 * serve one deployment's server list to another.
 */

import {
  API_PATH,
  API_VERSION,
  CATALOGUE_DISCLAIMER,
  DEFAULT_PAGE_SIZE,
  ENDPOINTS,
  ERROR_CODES,
  ERROR_STATUS,
  MAX_PAGE_SIZE,
  RATE_LIMIT,
} from './contract'

/* -------------------------------------------------------------------------- */
/* Reusable pieces                                                             */
/* -------------------------------------------------------------------------- */

const DISCLAIMER_DESCRIPTION = 'The same disclaimer every response carries, so a client need not compose its own.'

/**
 * A reference into `components.schemas`.
 *
 * Used wherever a shape appears in more than one place, so the document names it
 * once instead of inlining it into every path that carries it. That is not
 * tidiness for its own sake: code generators turn a referenced schema into a
 * named exported type and an inlined one into an anonymous object literal, so a
 * client built from this document reads `ProgrammeSummary` rather than the same
 * three-level-deep literal written out at four call sites. Writing the shapes
 * inline and *also* listing them under `components` would leave six entries
 * nothing points at, which a linter reports and a reader has to resolve by hand.
 */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const META_SCHEMA = {
  type: 'object',
  description: 'Present on every successful response, including one with an empty page.',
  required: ['source', 'generatedAt', 'apiVersion', 'disclaimer'],
  properties: {
    source: {
      type: 'string',
      enum: ['ibass', 'sample', 'built-in'],
      description:
        "`ibass` is the JAMB IBASS e-brochure mirror. `sample` means the database was unreachable and a small built-in sample answered instead — a degraded read, not an error, but a client should not present a sample as the whole catalogue. `built-in` means the answer did not come from the catalogue at all, as with `/subjects`.",
    },
    generatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When this response was built. Not when the catalogue was last crawled.',
    },
    apiVersion: { type: 'string', const: API_VERSION },
    disclaimer: { type: 'string', description: DISCLAIMER_DESCRIPTION },
  },
} as const

const PAGINATION_SCHEMA = {
  type: 'object',
  description: 'Present on list responses only. Absent — not null — elsewhere.',
  required: ['limit', 'nextCursor', 'total'],
  properties: {
    limit: {
      type: 'integer',
      description: `The page size actually applied, after clamping to ${MAX_PAGE_SIZE}.`,
    },
    nextCursor: {
      type: ['string', 'null'],
      description:
        'Opaque. Pass back as `cursor` for the next page. Null on the last page. Do not parse it; its contents are not part of this contract.',
    },
    total: {
      type: 'integer',
      description:
        'How many rows matched, across every page. Present so a truncated page cannot be mistaken for the whole set.',
    },
  },
} as const

const ERROR_SCHEMA = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', enum: [...ERROR_CODES] },
        message: {
          type: 'string',
          description: 'Written for the integrating developer. Not copy for a student to read.',
        },
      },
    },
  },
} as const

const INSTITUTION_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'shortName', 'type', 'category', 'state', 'programmeCount', 'sourceUrl', 'sourceUpdatedAt'],
  properties: {
    id: {
      type: 'string',
      description:
        "JAMB's own stable institution identifier, so it survives a re-import of the brochure.",
    },
    name: { type: 'string', description: 'As the brochure prints it, often "NAME, CITY, STATE".' },
    shortName: { type: 'string', description: 'The same institution as a sentence refers to it.' },
    type: { type: ['string', 'null'], description: 'Federal, State, Private, Polytechnic and so on. Null when unrecorded.' },
    category: { type: ['string', 'null'] },
    state: { type: ['string', 'null'] },
    programmeCount: {
      type: 'integer',
      description:
        'How many programmes this catalogue holds for the institution — not how many it offers.',
    },
    sourceUrl: { type: 'string', format: 'uri' },
    sourceUpdatedAt: { type: 'string', format: 'date-time' },
  },
} as const

const PROGRAMME_SUMMARY_SCHEMA = {
  type: 'object',
  required: [
    'id',
    'institutionId',
    'institution',
    'institutionShort',
    'name',
    'department',
    'status',
    'utmeSubjects',
    'sourceUrl',
    'sourceUpdatedAt',
    'reviewedCourseId',
    'ruleStatus',
  ],
  properties: {
    id: { type: 'string', description: 'Stable. Used as the path parameter on the detail endpoint.' },
    institutionId: { type: 'string' },
    institution: { type: 'string' },
    institutionShort: { type: 'string' },
    name: { type: 'string' },
    department: { type: ['string', 'null'] },
    status: { type: ['string', 'null'], description: "IBASS's own status line for the programme, quoted." },
    utmeSubjects: {
      type: 'array',
      items: { type: 'string' },
      description:
        'The UTME combination exactly as IBASS publishes it — names, not codes, and not mapped to the vocabulary at /subjects. The brochure writes entries such as "Government/History", which have no code; folding the rest into codes would silently shorten a four-subject combination to three.',
    },
    sourceUrl: { type: 'string', format: 'uri' },
    sourceUpdatedAt: { type: 'string', format: 'date-time' },
    reviewedCourseId: {
      type: ['string', 'null'],
      description:
        'Set only where the in-app checker holds a reviewed course for this programme, which is rare: a handful of courses against twenty thousand programmes. Offer a check only where this is non-null.',
    },
    ruleStatus: {
      type: ['string', 'null'],
      enum: ['ready', 'no-source', null],
      description:
        "`ready` — a requirement was read and the checker can decide on it. `no-source` — reading was done and the brochure states no O'level requirement. `null` — nobody has looked yet.",
    },
  },
} as const

const PROGRAMME_DETAIL_SCHEMA = {
  description: 'A programme as a detail read carries it — the summary fields, plus the prose.',
  allOf: [
    ref('ProgrammeSummary'),
    {
      type: 'object',
      required: ['olevelRequirements', 'directEntryRequirements', 'remarks', 'checkerUrl'],
      properties: {
        olevelRequirements: {
          type: ['string', 'null'],
          description:
            "The brochure's own words, quoted. Null means the brochure states none — which is not the same as a requirement of nothing, and not a decision about any student.",
        },
        directEntryRequirements: { type: ['string', 'null'] },
        remarks: { type: ['string', 'null'] },
        checkerUrl: {
          type: ['string', 'null'],
          format: 'uri',
          description:
            'A link into the app\'s eligibility checker, where the checker holds a reviewed course for this programme. Null otherwise, which is the usual case. THIS API RETURNS NO VERDICT: a decision may only be presented by the checker itself, working from reviewed rules and saying which it used. Quote the requirements and link here; do not decide for a student.',
        },
      },
    },
  ],
} as const

/* -------------------------------------------------------------------------- */
/* The shapes a single endpoint returns                                        */
/* -------------------------------------------------------------------------- */

/**
 * What `/meta` reports before any paging.
 *
 * Named rather than inlined because it is the first thing an integrator reads:
 * it is how you learn whether the catalogue answered at all and how big it is.
 */
const CATALOGUE_STATS_SCHEMA = {
  type: 'object',
  description: 'The catalogue\'s size and freshness. Not a page of anything.',
  required: ['institutions', 'programmes', 'lastUpdatedAt', 'disclaimer'],
  properties: {
    institutions: { type: 'integer', description: 'Institutions the catalogue holds.' },
    programmes: { type: 'integer', description: 'Programmes across all institutions.' },
    lastUpdatedAt: {
      type: ['string', 'null'],
      format: 'date-time',
      description:
        'When the mirror was last taken from IBASS — not when this response was built, which `meta.generatedAt` gives, and not when any requirement was last reviewed. Null on the sample path.',
    },
    // Repeated here as well as in `meta` because this is the response an
    // integrator sizes their copy from, and the sentence belongs beside the
    // numbers it qualifies.
    disclaimer: { type: 'string', description: DISCLAIMER_DESCRIPTION },
  },
} as const

/**
 * `/institutions/{id}` — the institution, plus its programmes paged.
 *
 * The `pagination` on that response describes *these programmes*, not the
 * institution, which is the one thing about this endpoint a client gets wrong.
 * The field descriptions say so at the point of use.
 */
const INSTITUTION_DETAIL_SCHEMA = {
  type: 'object',
  required: ['institution', 'programmes'],
  properties: {
    // Bare, with no sibling `description`: a `$ref` beside other keywords is legal
    // in 3.1 but linters flag it and some generators drop the siblings, and this
    // schema needs no gloss the `Institution` entry does not already carry.
    institution: ref('Institution'),
    programmes: {
      type: 'array',
      items: ref('ProgrammeSummary'),
      description:
        'This institution\'s programmes, paged by this endpoint\'s own `limit` and `cursor` — the same `pagination` object describes these, not the institution. For a filtered set, or one larger than a page, use `/programmes?institutionId=`.',
    },
  },
} as const

/** The subject and grade vocabulary, as `/subjects` serves it. */
const VOCABULARY_SCHEMA = {
  type: 'object',
  required: ['subjects', 'grades', 'alwaysRequired'],
  properties: {
    subjects: {
      type: 'array',
      description: 'Every subject code this catalogue uses, with the name it means.',
      items: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string', description: 'Send this as `subject=` on `/programmes`.' },
          name: { type: 'string' },
        },
      },
    },
    grades: {
      type: 'array',
      description: 'The O\'level grade table. Serve this; do not infer your own.',
      items: {
        type: 'object',
        required: ['code', 'credit', 'meaning'],
        properties: {
          code: { type: 'string' },
          credit: {
            type: 'boolean',
            description:
              'Whether this grade satisfies a subject requirement. A1–C6 are credits; D7 and E8 are passes that satisfy nothing; F9 is a fail. Serve this rather than letting a client infer its own table — every eligibility error in this domain comes from treating a pass as a credit.',
          },
          meaning: { type: 'string' },
        },
      },
    },
    alwaysRequired: {
      type: 'array',
      items: { type: 'string' },
      description: 'Subject codes every programme requires — English Language and Mathematics.',
    },
  },
} as const

/* -------------------------------------------------------------------------- */
/* Parameters                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every query parameter the contract mentions, described once.
 *
 * `ENDPOINTS[].params` names which apply where, so adding a parameter to an
 * endpoint is one edit in `contract.ts` and one here — and a test asserts the two
 * agree, so a name with no description cannot reach the published document.
 */
const PARAMETERS: Record<string, Record<string, unknown>> = {
  state: {
    name: 'state',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Exact state name, e.g. `Lagos`. Case-insensitive.',
  },
  type: {
    name: 'type',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Institution type, e.g. `Federal University`.',
  },
  category: {
    name: 'category',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: '`University`, `Polytechnic`, `College of Education` and similar.',
  },
  q: {
    name: 'q',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description:
      'Free text, matched as a substring ignoring case. On `/institutions` over the name, the state and the institution type; on `/programmes` over the programme name and the institution\'s name, so `q=UNILAG nursing` narrows to that school. Not parsed as language: send `q=nursing&state=Lagos` rather than `q=nursing in Lagos`.',
  },
  institutionId: {
    name: 'institutionId',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'An institution `id` from `/institutions`.',
  },
  subject: {
    name: 'subject',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description:
      'A subject **code** from `/subjects`, e.g. `BIO` — not a name. `subject=Biology` is a `400` rather than an empty page, because a code we do not publish would otherwise look like a catalogue holding nothing. Returns programmes whose published UTME combination mentions that subject.',
  },
  limit: {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
    description: `Rows per page. Clamped to ${MAX_PAGE_SIZE}; a larger value is not an error, and the response reports what was applied.`,
  },
  cursor: {
    name: 'cursor',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description:
      'The `pagination.nextCursor` from the previous page. Opaque — do not construct one. A malformed cursor is a `400`.',
  },
}

/* -------------------------------------------------------------------------- */
/* The document                                                                */
/* -------------------------------------------------------------------------- */

function success(description: string, schema: Record<string, unknown>): Record<string, unknown> {
  return {
    description,
    headers: {
      'X-RateLimit-Limit': { schema: { type: 'integer' }, description: 'Requests allowed per window.' },
      'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Requests left in this window.' },
      'X-RateLimit-Reset': { schema: { type: 'integer' }, description: 'When the window ends, as Unix seconds.' },
    },
    content: { 'application/json': { schema } },
  }
}

function listEnvelope(itemSchema: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'object',
    required: ['data', 'pagination', 'meta'],
    properties: {
      data: { type: 'array', items: itemSchema },
      pagination: ref('Pagination'),
      meta: ref('Meta'),
    },
  }
}

function itemEnvelope(itemSchema: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'object',
    required: ['data', 'meta'],
    properties: { data: itemSchema, meta: ref('Meta') },
  }
}

/**
 * The failures every endpoint can return, gathered once.
 *
 * `unavailable` is on all of them and is not a code a client should treat as
 * fatal: it also means "the catalogue database was unreachable", which the next
 * request may not be.
 */
function failures(...codes: (typeof ERROR_CODES)[number][]): Record<string, unknown> {
  const described: Record<string, string> = {
    unauthorized: 'No API key, or one this deployment does not accept. Check the key, not the request.',
    bad_request: 'A parameter could not be read — a non-numeric `limit`, or a cursor this API did not issue.',
    not_found: 'No such institution or programme, or the catalogue holds no `sample` row for it.',
    rate_limited: `More than ${RATE_LIMIT.requests} requests in ${RATE_LIMIT.windowMs / 1000} seconds on this key. Honour \`Retry-After\`.`,
    unavailable:
      'Either `CATALOGUE_API_KEYS` is unset on the server — ours to fix, not yours — or a read failed. Try again shortly.',
  }

  return Object.fromEntries(
    codes.map((code) => [
      String(ERROR_STATUS[code]),
      { description: described[code], content: { 'application/json': { schema: ref('Error') } } },
    ]),
  )
}

/** The parameter objects for one endpoint, from the names the contract lists. */
function parametersFor(path: string): Record<string, unknown>[] {
  const spec = ENDPOINTS.find((endpoint) => endpoint.path === path)
  // A name in the contract with no entry in `PARAMETERS` would publish an
  // `undefined` into the document and break every client generated from it, so
  // it is dropped here rather than serialised — and a test asserts the two lists
  // agree, which is what stops it happening at all.
  const query = (spec?.params ?? [])
    .map((name) => PARAMETERS[name])
    .filter((parameter): parameter is Record<string, unknown> => Boolean(parameter))

  const pathParams: Record<string, unknown>[] = path.includes('{id}')
    ? [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description:
            path.startsWith('/institutions')
              ? 'An institution `id` from `/institutions`.'
              : 'A programme `id` from `/programmes`.',
        },
      ]
    : []

  return [...pathParams, ...query]
}

/**
 * Which of the document's tags an endpoint belongs under.
 *
 * The three tags are declared on the document, and every operation has to name
 * one of them: a tag nothing references renders as an empty heading in a
 * generated reference, which reads as a section that failed to load.
 *
 * Split by what a client is doing rather than by URL — `/subjects` is not a
 * catalogue read, it is the vocabulary a client needs in order to talk about
 * catalogues at all, and an integrator looks for it under its own heading.
 */
function tagFor(path: string): string {
  if (path === '/subjects') return 'Vocabulary'
  if (path === '/openapi.json') return 'Contract'
  return 'Catalogue'
}

function pathItem(path: string): Record<string, unknown> {
  const spec = ENDPOINTS.find((endpoint) => endpoint.path === path)!

  const body = ((): Record<string, unknown> => {
    switch (path) {
      case '/meta':
        return itemEnvelope(ref('CatalogueStats'))
      case '/institutions':
        return listEnvelope(ref('Institution'))
      case '/institutions/{id}':
        return {
          type: 'object',
          required: ['data', 'pagination', 'meta'],
          properties: {
            data: ref('InstitutionDetail'),
            pagination: ref('Pagination'),
            meta: ref('Meta'),
          },
        }
      case '/programmes':
        return listEnvelope(ref('ProgrammeSummary'))
      case '/programmes/{id}':
        return itemEnvelope(ref('ProgrammeDetail'))
      case '/subjects':
        return itemEnvelope(ref('Vocabulary'))
      case '/openapi.json':
        return { type: 'object', description: 'This document.' }
      default:
        return itemEnvelope({})
    }
  })()

  return {
    get: {
      summary: spec.summary,
      tags: [tagFor(path)],
      operationId: path === '/openapi.json'
        ? 'getOpenApiDocument'
        : `get${path.replace(/[{}/]/g, ' ').trim().split(/[\s-]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`,
      parameters: parametersFor(path),
      responses: {
        ...failures('unauthorized', 'rate_limited', 'unavailable', ...(path.includes('{id}') ? (['not_found'] as const) : []), ...(spec.params.length ? (['bad_request'] as const) : [])),
        200: success(spec.summary, body as Record<string, unknown>),
      },
    },
  }
}

/**
 * The document.
 *
 * Pure: same input, same output. The one argument is the address the API is
 * reachable at, used for `servers` only, and it is passed in rather than read
 * from `process.env` so that a test and a request produce the same bytes.
 */
export function openApiDocument(baseUrl: string | null): Record<string, unknown> {
  const paths = Object.fromEntries(ENDPOINTS.map((endpoint) => [endpoint.path, pathItem(endpoint.path)]))

  const servers = baseUrl ? [{ url: `${baseUrl.replace(/\/+$/, '')}${API_PATH}` }] : [{ url: API_PATH }]

  return {
    openapi: '3.1.0',
    info: {
      title: 'Admission Copilot Catalogue API',
      version: API_VERSION,
      // No open-source licence is granted: access is by key, to an integrator we
      // agreed terms with. `LicenseRef-Proprietary` is the SPDX way to say that
      // without pointing at terms that do not exist at a public URL, and it is
      // what the linter's stricter rule asks for.
      license: { name: 'Proprietary', identifier: 'LicenseRef-Proprietary' },
      summary: 'Read-only access to the Nigerian admissions catalogue behind Admission Copilot.',
      description: [
        'Institutions, programmes, their UTME subject combinations and the requirement prose JAMB\'s IBASS e-brochure publishes — plus the subject and grade vocabulary this catalogue uses.',
        '',
        '**This API returns no verdict.** It carries the brochure\'s own words, quoted, with the URL they came from, and hands out a link into Admission Copilot\'s eligibility checker where the checker holds a reviewed course. A decision may only be presented by that checker, because only it can say which of the two rule sets it decided from.',
        '',
        'Everything served here is already public. The API holds no student data and has no route that reads any.',
        '',
        `Rate limit: ${RATE_LIMIT.requests} requests per key per ${RATE_LIMIT.windowMs / 1000} seconds, enforced per server instance as a runaway guard rather than as a metered quota. Honour \`Retry-After\`.`,
        '',
        CATALOGUE_DISCLAIMER,
        '',
        'Additive change is expected within this version: new fields may appear on any response, and a client should ignore what it does not read. A field is only removed or repurposed under a new version in the path.',
      ].join('\n'),
    },
    servers,
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    tags: [
      { name: 'Catalogue', description: 'Institutions, programmes and the size of the catalogue.' },
      { name: 'Vocabulary', description: 'The subject codes and the grade table, so a client need not invent either.' },
      { name: 'Contract', description: 'This document.' },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: '`Authorization: Bearer <key>`. Preferred, and what most HTTP clients do by default.',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'The same key by the other common convention. `Authorization` wins when both are sent.',
        },
      },
      schemas: {
        // Every one of these is pointed at by at least one path, which is what
        // keeps the entry list honest: a schema named here and referenced nowhere
        // is a shape a reader has to reconcile against the paths by hand.
        Institution: INSTITUTION_SCHEMA,
        InstitutionDetail: INSTITUTION_DETAIL_SCHEMA,
        ProgrammeSummary: PROGRAMME_SUMMARY_SCHEMA,
        ProgrammeDetail: PROGRAMME_DETAIL_SCHEMA,
        CatalogueStats: CATALOGUE_STATS_SCHEMA,
        Vocabulary: VOCABULARY_SCHEMA,
        Meta: META_SCHEMA,
        Pagination: PAGINATION_SCHEMA,
        Error: ERROR_SCHEMA,
      },
    },
  }
}
