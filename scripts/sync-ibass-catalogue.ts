/**
 * Mirror JAMB IBASS's public brochure into the local catalogue tables.
 *
 * Run `yarn catalogue:sync` after `yarn db:push`. This is intentionally a
 * one-way, reviewable import; it does not scrape or guess course rules from
 * another site. IBASS remains the source of truth for all imported records.
 */
import { loadEnvLocal } from '../lib/db/load-env'

loadEnvLocal()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import { catalogueInstitutions, catalogueProgrammes } from '../lib/db/schema'

const API = 'https://ibass-api.jamb.gov.ng/api'
const BROCHURE_URL = 'https://ibass.jamb.gov.ng/brochure-by-institution'
const REQUEST_PAUSE_MS = 200
const REQUEST_TIMEOUT_MS = 60_000
const MAX_REQUEST_ATTEMPTS = 4

type ApiRecord = Record<string, unknown>

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function pick(record: ApiRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = text(record[key])
    if (value) return value
  }
  return null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (item && typeof item === 'object') return [pick(item as ApiRecord, 'label', 'title', 'name', 'value')].filter(
      (entry): entry is string => Boolean(entry),
    )
    return []
  })
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function retryable(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'TimeoutError') return true
  if (error instanceof TypeError && error.message === 'fetch failed') return true
  return false
}

async function request(path: string, body?: ApiRecord): Promise<ApiRecord> {
  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${API}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (response.ok) return (await response.json()) as ApiRecord
      if (response.status < 429 || response.status >= 500 || attempt === MAX_REQUEST_ATTEMPTS) {
        throw new Error(`${path} returned ${response.status}`)
      }
      console.warn(`IBASS ${path} returned ${response.status}; retrying (${attempt}/${MAX_REQUEST_ATTEMPTS})...`)
    } catch (error) {
      if (!retryable(error) || attempt === MAX_REQUEST_ATTEMPTS) throw error
      console.warn(`IBASS ${path} was unavailable; retrying (${attempt}/${MAX_REQUEST_ATTEMPTS})...`)
    }

    // Back off before retrying so a temporarily overloaded upstream can recover.
    await sleep(1_000 * 2 ** (attempt - 1))
  }

  throw new Error(`IBASS request ${path} exhausted all retry attempts.`)
}

function records(payload: ApiRecord): ApiRecord[] {
  const root = payload.data
  if (Array.isArray(root)) return root.filter((value): value is ApiRecord => Boolean(value && typeof value === 'object'))
  if (root && typeof root === 'object') {
    const data = (root as ApiRecord).data
    if (Array.isArray(data)) return data.filter((value): value is ApiRecord => Boolean(value && typeof value === 'object'))
  }
  return []
}

function pages(payload: ApiRecord): number {
  const root = payload.data
  if (root && typeof root === 'object') return Number((root as ApiRecord).last_page ?? 1)
  return 1
}

function valueForFilter(item: ApiRecord): string {
  return pick(item, 'id', 'value', 'title', 'name') ?? ''
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required for catalogue:sync.')

  const db = drizzle(neon(url))
  const importedAt = new Date()
  const types = records(await request('/inst-type'))
  if (!types.length) throw new Error('IBASS returned no institution types; the import was not changed.')

  let institutionCount = 0
  let programmeCount = 0

  for (const type of types) {
    const institutionType = valueForFilter(type)
    const categories = records(await request('/inst-category', { inst_type: institutionType }))
    // IBASS accepts a type-wide query with an empty category. Categories are
    // retained only as metadata; querying once prevents duplicate institutions.
    const firstPage = await request('/ibass/institutions?page=1', {
      inst_type: institutionType,
      inst_category: '',
      inst_search: '',
    })

    const institutionPages = pages(firstPage)
    const allInstitutions = records(firstPage)
    for (let page = 2; page <= institutionPages; page += 1) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_PAUSE_MS))
      allInstitutions.push(
        ...records(
          await request(`/ibass/institutions?page=${page}`, {
            inst_type: institutionType,
            inst_category: '',
            inst_search: '',
          }),
        ),
      )
    }

    for (const institution of allInstitutions) {
      const institutionId = pick(institution, 'id', 'institution_id')
      const name = pick(institution, 'title', 'name', 'institution_name')
      if (!institutionId || !name) continue

      const categoryId = pick(institution, 'inst_category', 'category_id', 'category')
      const category = categories.find((item) => valueForFilter(item) === categoryId)
      const row = {
        id: institutionId,
        name,
        institutionType: pick(type, 'title', 'name') ?? institutionType,
        category: category ? pick(category, 'title', 'name') : categoryId,
        state: pick(institution, 'state', 'state_name'),
        sourceUrl: BROCHURE_URL,
        sourceUpdatedAt: importedAt,
      }
      await db.insert(catalogueInstitutions).values(row).onConflictDoUpdate({ target: catalogueInstitutions.id, set: row })
      institutionCount += 1

      const programmeFirstPage = await request(`/ibass/institution/programmes/${institutionId}?page=1`, {
        course_search: '',
      })
      const programmePages = pages(programmeFirstPage)
      const programmes = records(programmeFirstPage)
      for (let page = 2; page <= programmePages; page += 1) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_PAUSE_MS))
        programmes.push(...records(await request(`/ibass/institution/programmes/${institutionId}?page=${page}`, { course_search: '' })))
      }

      for (const programme of programmes) {
        const programmeId = pick(programme, 'id', 'programme_id', 'course_id')
        const programmeName = pick(programme, 'title', 'name', 'programme')
        if (!programmeId || !programmeName) continue
        const row = {
          id: `${institutionId}:${programmeId}`,
          institutionId,
          name: programmeName,
          department: pick(programme, 'department', 'faculty'),
          status: pick(programme, 'status'),
          utmeSubjects: stringList(programme.utme_subjects ?? programme.utmeSubjects ?? programme.subjects),
          olevelRequirements: pick(programme, 'utme_requirements', 'olevel_requirements', 'o_level_requirements'),
          directEntryRequirements: pick(programme, 'de_requirements', 'direct_entry_requirements'),
          remarks: pick(programme, 'remarks', 'remark'),
          sourceUrl: BROCHURE_URL,
          sourceUpdatedAt: importedAt,
        }
        await db.insert(catalogueProgrammes).values(row).onConflictDoUpdate({ target: catalogueProgrammes.id, set: row })
        programmeCount += 1
      }
    }
  }

  console.log(`Imported ${institutionCount} institutions and ${programmeCount} programmes from JAMB IBASS.`)
}

main().catch((error) => {
  console.error('IBASS catalogue sync failed:', error)
  process.exit(1)
})
