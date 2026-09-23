/**
 * Ask IBASS what it actually publishes.
 *
 * WHY THIS EXISTS: the mirror holds no universities. Its `institution_type`
 * column carries exactly two values, ND and NCE, and the sync can only import
 * the types it is told about — it iterates whatever `/inst-type` returns and
 * nothing else. Either the API publishes more types than one call to that path
 * reveals, or the path itself is wrong. Both are answerable in a few requests,
 * and guessing between them would mean rewriting the import twice.
 *
 * READ-ONLY. It issues GETs and POSTs against public brochure endpoints and
 * writes nothing — not to the database, not to disk. It can be run at any time,
 * including while a sync is in flight.
 *
 *   yarn catalogue:probe
 *
 * The route names here deliberately overlap the sync's so a divergence between
 * the two is visible: `/inst-type` and `/inst-category` are called by the sync
 * WITHOUT the `/ibass/` prefix that `/ibass/institutions` carries, which is worth
 * a direct comparison rather than an assumption.
 */

const API = 'https://ibass-api.jamb.gov.ng/api'
const REQUEST_TIMEOUT_MS = 30_000

type ApiRecord = Record<string, unknown>

/** Paths to compare for the type list. The sync's, and the likely-correct one. */
const TYPE_PATHS = ['/inst-type', '/ibass/inst-type']

async function request(path: string, body?: ApiRecord): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body
      ? { 'Content-Type': 'application/json', Accept: 'application/json' }
      : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    return { __error: `${response.status} ${response.statusText}` }
  }

  return response.json()
}

/** Mirrors the sync's reader so the probe shows what the sync would actually see. */
function records(payload: unknown): ApiRecord[] {
  if (!payload || typeof payload !== 'object') return []
  const root = (payload as ApiRecord).data
  if (Array.isArray(root)) {
    return root.filter((value): value is ApiRecord => Boolean(value && typeof value === 'object'))
  }
  if (root && typeof root === 'object') {
    const nested = (root as ApiRecord).data
    if (Array.isArray(nested)) {
      return nested.filter((value): value is ApiRecord => Boolean(value && typeof value === 'object'))
    }
  }
  return []
}

function show(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/**
 * Every key a record carries, so a field the sync never reads is still visible.
 *
 * The sync picks fields by name from a fixed list. If IBASS publishes the
 * degree-awarding flag under a key that list does not contain, the sync would
 * import the row and drop the distinction — which is the shape of the bug being
 * investigated, so the probe prints keys rather than only values.
 */
function keysOf(record: ApiRecord): string {
  return Object.keys(record).sort().join(', ')
}

async function main() {
  for (const path of TYPE_PATHS) {
    const payload = await request(path)
    const rows = records(payload)

    console.log(`\n${'='.repeat(72)}`)
    console.log(`GET ${path}`)
    console.log('='.repeat(72))

    if (!rows.length) {
      console.log(`No records. Raw response:\n${show(payload).slice(0, 2_000)}`)
      continue
    }

    console.log(`${rows.length} type(s). First record's keys: ${keysOf(rows[0]!)}`)
    console.log(show(rows))
  }

  // The sync's own type list decides everything downstream, so the rest of the
  // probe follows whichever path it reads rather than the one that looks right.
  const types = records(await request(TYPE_PATHS[0]!))
  if (!types.length) {
    console.log('\nNo types from the sync path — nothing further to probe.')
    return
  }

  for (const type of types) {
    const institutionType = String(
      type.id ?? type.value ?? type.title ?? type.name ?? '',
    ).trim()
    if (!institutionType) continue

    console.log(`\n${'-'.repeat(72)}`)
    console.log(`TYPE ${institutionType}`)
    console.log('-'.repeat(72))

    for (const path of ['/inst-category', '/ibass/inst-category']) {
      const categories = records(await request(path, { inst_type: institutionType }))
      console.log(`${path} → ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`)
      if (categories.length) console.log(show(categories.slice(0, 3)))
    }

    const page = await request('/ibass/institutions?page=1', {
      inst_type: institutionType,
      inst_category: '',
      inst_search: '',
    })
    const institutions = records(page)
    console.log(`\nInstitutions: ${institutions.length} on page 1`)

    const first = institutions[0]
    if (!first) {
      // A type that advertises itself and then yields no institutions is exactly
      // the silent truncation this probe exists to catch.
      console.log('!! This type returned no institutions. That is the failure mode.')
      continue
    }

    console.log(`Keys: ${keysOf(first)}`)
    console.log(show(first))

    const institutionId = String(first.id ?? first.institution_id ?? '').trim()
    if (!institutionId) {
      console.log('No institution id on the first record; cannot probe programmes.')
      continue
    }

    const programmePage = await request(`/ibass/institution/programmes/${institutionId}?page=1`, {
      course_search: '',
    })
    const programmes = records(programmePage)
    console.log(`\nProgrammes for ${institutionId}: ${programmes.length} on page 1`)
    if (programmes[0]) {
      console.log(`Keys: ${keysOf(programmes[0])}`)
      console.log(show(programmes[0]))
    }
  }
}

main().catch((error) => {
  console.error('Probe failed:', error)
  process.exit(1)
})
