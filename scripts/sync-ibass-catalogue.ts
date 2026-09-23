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
import { count, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'

import { catalogueInstitutions, catalogueProgrammes } from '../lib/db/schema'
import { nameKey } from '../lib/discovery'

const API = 'https://ibass-api.jamb.gov.ng/api'
const BROCHURE_URL = 'https://ibass.jamb.gov.ng/brochure-by-institution'
const REQUEST_PAUSE_MS = 200
const REQUEST_TIMEOUT_MS = 60_000
const MAX_REQUEST_ATTEMPTS = 4

/**
 * How many programme rows go into one upsert.
 *
 * Each row is ten columns, so this is around two thousand bind parameters —
 * comfortably inside every limit that matters. Schools average a few dozen
 * programmes, so most fit in a single statement and the batch size only bites on
 * the largest.
 */
const PROGRAMME_BATCH_SIZE = 200

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

const WRITE_ATTEMPTS = 4

/**
 * A catalogue write is safe to repeat, and that is the entire reason it can be
 * retried. Every write below is an `onConflictDoUpdate` upsert built from values
 * already in hand, so a second attempt either performs a write that never landed
 * or rewrites a row with exactly what it already holds.
 *
 * This matters because a dropped connection leaves the outcome genuinely
 * unknown: the row may have committed before the response was lost. Anything not
 * safe to repeat could not be retried here at all.
 *
 * The Neon driver wraps its transport failures, so the signal we need sits on
 * `sourceError`, not on the error that reaches us. A real SQL error carries no
 * `sourceError` and is deliberately not retried — repeating it would only fail
 * the same way four times.
 */
function retryableWrite(error: unknown): boolean {
  if (retryable(error)) return true
  const source = (error as { sourceError?: unknown } | null)?.sourceError
  return source ? retryable(source) : false
}

/**
 * The database half of the import needs the same protection the API half already
 * has. Without it a momentary drop costs the whole run: the API calls above
 * survive one and carry on, so an unprotected write is the only thing left that
 * can end a multi-minute import.
 *
 * `operation` builds a fresh query per attempt, which is required — a drizzle
 * builder is thenable rather than a reusable promise.
 */
async function write(operation: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt += 1) {
    try {
      await operation()
      return
    } catch (error) {
      if (!retryableWrite(error) || attempt === WRITE_ATTEMPTS) throw error
      console.warn(`Catalogue write was interrupted; retrying (${attempt}/${WRITE_ATTEMPTS})...`)
    }

    // Back off before retrying, matching the API calls above.
    await sleep(1_000 * 2 ** (attempt - 1))
  }
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

/** How many records IBASS says this collection holds in total. */
function totalRecords(payload: ApiRecord): number {
  const root = payload.data
  if (root && typeof root === 'object') return Number((root as ApiRecord).total ?? 0)
  return 0
}

function valueForFilter(item: ApiRecord): string {
  return pick(item, 'id', 'value', 'title', 'name') ?? ''
}

/**
 * Universities before everything else, IBASS's own order preserved inside each.
 *
 * This pass runs for hours, and the order it runs in decides which schools are
 * usable while it does. IBASS's order is arbitrary with respect to what anyone
 * searches for: of the 529 degree-awarding institutions, 212 are colleges and
 * seminaries grouped under "other", interleaved with the universities a student
 * is overwhelmingly more likely to look for. Sorting by that one word costs
 * nothing and means the schools that matter are complete early rather than last.
 *
 * Needs the type's categories because an institution carries its category's id,
 * not its name — the title that says "FEDERAL UNIVERSITIES" lives in the
 * category record, resolved the same way the institution row is built. A stable
 * sort, so within a tier the original order still holds.
 */
function universityFirst(categories: ApiRecord[]): (a: ApiRecord, b: ApiRecord) => number {
  function isUniversity(institution: ApiRecord): boolean {
    const categoryId = pick(institution, 'inst_category', 'category_id', 'category')
    const category = categories.find((item) => valueForFilter(item) === categoryId)
    const label = pick(category ?? {}, 'title', 'name') ?? categoryId ?? ''
    return label.toUpperCase().includes('UNIVERSIT')
  }

  return (a, b) => Number(isUniversity(b)) - Number(isUniversity(a))
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required for catalogue:sync.')

  const db = drizzle(neon(url))
  const importedAt = new Date()

  // Resumability is opt-in, because the ordinary reason to run this is to pick
  // up changes in IBASS — and skipping every institution we already hold would
  // silently import nothing. With RESUME=1 a run that died partway can simply be
  // restarted, and it will redo only what it had not finished.
  //
  // Completion is judged by programmes, not by the institution row. The
  // institution insert happens first, so an institution interrupted between the
  // two writes is redone rather than skipped.
  //
  // A COUNT, not a yes/no. "Has any programme" looks like it means "is done",
  // and it does not: an institution interrupted partway through its pages keeps
  // whatever landed and is then skipped by every later run. Ahmadu Bello
  // University sat at 15 of IBASS's 118 that way — the mirror looked imported
  // and the gap could never close. Comparing against the total IBASS reports
  // makes the check exact, and costs one page-one request we were making
  // anyway.
  const storedCounts =
    process.env.RESUME === '1'
      ? new Map(
          (
            await db
              .select({ id: catalogueProgrammes.institutionId, total: count() })
              .from(catalogueProgrammes)
              .groupBy(catalogueProgrammes.institutionId)
          ).map((row) => [row.id, Number(row.total)]),
        )
      : null
  let skippedCount = 0

  const types = records(await request('/inst-type'))
  if (!types.length) throw new Error('IBASS returned no institution types; the import was not changed.')

  /**
   * Import one type only, by id or by name — `TYPE=4`, `TYPE=degree`.
   *
   * The full import is hours long, and IBASS lists its types in a fixed order
   * that puts degree-awarding institutions last. That makes the schools most
   * students are looking for both the last to arrive and the first lost to an
   * interrupted run — which is exactly how the mirror came to hold 839
   * institutions without a single university. Naming one type turns that
   * ordering from a consequence into a choice.
   */
  const only = process.env.TYPE?.trim().toLowerCase() ?? ''
  const selected = only
    ? types.filter((type) =>
        [valueForFilter(type), pick(type, 'title', 'name') ?? ''].some((value) =>
          value.toLowerCase().includes(only),
        ),
      )
    : types

  if (only && !selected.length) {
    throw new Error(
      `TYPE=${process.env.TYPE} matched no institution type. IBASS advertises: ${types
        .map((type) => `${valueForFilter(type)}=${pick(type, 'title', 'name')}`)
        .join(', ')}.`,
    )
  }

  let institutionCount = 0
  let programmeCount = 0

  /**
   * What each advertised type actually produced.
   *
   * A single total for the run cannot say which type is missing, and a missing
   * type is invisible: every other type succeeds, so the run looks healthy while
   * an entire category — universities, in the case that prompted this — is
   * absent. IBASS lists its types in a fixed order and this loop follows it, so
   * the type at the end of the list is always the one lost when a run is cut
   * short. Per-type counts turn that into something the run states outright.
   */
  const perType = new Map<string, { institutions: number; programmes: number }>()
  const typeLabels = new Map<string, string>()

  /**
   * Import only the schools named here — `SCHOOL="university of lagos, rivers state"`.
   *
   * The full sweep is hours, and the schools a student is most likely to look
   * for are not the ones IBASS lists first. Naming them turns "wait for all 529"
   * into "have the ones that matter now" — the same trade the `TYPE` filter makes
   * one level up, and the two compose.
   *
   * A name is folded through the app's own `nameKey` before comparing, so a
   * school typed the way a person types it matches the row IBASS actually
   * writes: case, hyphens and doubled spaces all fold away, and "University of
   * Port Harcourt" finds `UNIVERSITY OF PORT-HARCOURT, RIVERS STATE`. JAMB's
   * numeric id works too. Sharing the fold rather than reimplementing it is
   * deliberate — a search that disagrees with the import is how a school ends up
   * unfindable while looking present.
   */
  const schoolNeedles = (process.env.SCHOOL ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const matchedCounts = new Map<string, number>()

  function schoolWanted(institution: ApiRecord): boolean {
    if (!schoolNeedles.length) return true

    const id = pick(institution, 'id', 'institution_id')
    const name = nameKey(pick(institution, 'title', 'name', 'institution_name') ?? '')

    let wanted = false
    // Deliberately not `some`: every needle is checked so the summary can say
    // how many schools each name pulled in. One name commonly matches several —
    // "University of Ibadan" also matches the colleges affiliated to it — and
    // that is worth stating outright rather than leaving to be discovered in the
    // institution count.
    for (const needle of schoolNeedles) {
      const folded = nameKey(needle)
      const hit = (id !== null && id === needle.trim()) || (folded !== '' && name.includes(folded))
      if (!hit) continue
      wanted = true
      matchedCounts.set(needle, (matchedCounts.get(needle) ?? 0) + 1)
    }

    return wanted
  }

  for (const type of selected) {
    const institutionType = valueForFilter(type)
    typeLabels.set(institutionType, pick(type, 'title', 'name') ?? institutionType)
    perType.set(institutionType, { institutions: 0, programmes: 0 })
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

    // Narrowed here, once, so both passes below work from the same list. The
    // full type is still fetched — IBASS has no name search on this endpoint we
    // can rely on, and twenty pages of institution rows is a second, not the
    // bottleneck.
    const wanted = allInstitutions.filter(schoolWanted).sort(universityFirst(categories))

    /**
     * Institutions first, as a pass of their own.
     *
     * The rows are written before any programme is fetched, so the school list
     * becomes complete within seconds of a type starting rather than arriving one
     * school at a time behind its own programmes. Fetching a school's programmes
     * before writing the school means the school is invisible until the last of
     * them lands — around two minutes each, which puts a usable list of
     * universities hours away and makes an interrupted run look like it did
     * nothing at all.
     *
     * This does not weaken `RESUME=1`. Completion is still judged by whether
     * programmes exist, so a school written here and interrupted before its
     * programmes are fetched is redone by the second pass rather than skipped.
     */
    for (const institution of wanted) {
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
      await write(() =>
        db
          .insert(catalogueInstitutions)
          .values(row)
          .onConflictDoUpdate({ target: catalogueInstitutions.id, set: row }),
      )
      institutionCount += 1
      const tally = perType.get(institutionType)
      if (tally) tally.institutions += 1
    }

    for (const institution of wanted) {
      const institutionId = pick(institution, 'id', 'institution_id')
      const name = pick(institution, 'title', 'name', 'institution_name')
      if (!institutionId || !name) continue

      const programmeFirstPage = await request(`/ibass/institution/programmes/${institutionId}?page=1`, {
        course_search: '',
      })
      const programmePages = pages(programmeFirstPage)
      const programmes = records(programmeFirstPage)

      // Page one is fetched before this decision either way, so resuming costs
      // one request per institution and saves every page beyond the first —
      // which, for the two thirds of schools with more than one page, is most of
      // the work. An institution whose stored count disagrees with IBASS is
      // re-imported in full: the pages are upserts, so redoing one is safe, and
      // a partial school is worse than a repeated fetch.
      if (storedCounts?.get(institutionId) === totalRecords(programmeFirstPage)) {
        skippedCount += 1
        continue
      }

      for (let page = 2; page <= programmePages; page += 1) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_PAUSE_MS))
        programmes.push(...records(await request(`/ibass/institution/programmes/${institutionId}?page=${page}`, { course_search: '' })))
      }

      const rows = programmes.flatMap((programme) => {
        const programmeId = pick(programme, 'id', 'programme_id', 'course_id')
        const programmeName = pick(programme, 'title', 'name', 'programme')
        if (!programmeId || !programmeName) return []
        return [
          {
            id: `${institutionId}:${programmeId}`,
            institutionId,
            name: programmeName,
            department: pick(programme, 'department', 'faculty'),
            status: pick(programme, 'status'),
            utmeSubjects: stringList(
              programme.utme_subjects ?? programme.utmeSubjects ?? programme.subjects,
            ),
            olevelRequirements: pick(
              programme,
              'utme_requirements',
              'olevel_requirements',
              'o_level_requirements',
            ),
            directEntryRequirements: pick(programme, 'de_requirements', 'direct_entry_requirements'),
            remarks: pick(programme, 'remarks', 'remark'),
            sourceUrl: BROCHURE_URL,
            sourceUpdatedAt: importedAt,
          },
        ]
      })

      for (let start = 0; start < rows.length; start += PROGRAMME_BATCH_SIZE) {
        const batch = rows.slice(start, start + PROGRAMME_BATCH_SIZE)
        await write(() =>
          db
            .insert(catalogueProgrammes)
            .values(batch)
            // A multi-row upsert cannot reuse the inserted values as the update
            // set — the literal would be applied to whichever row conflicted.
            // `excluded` is the row being inserted, which is what a single-row
            // upsert means by `set: row`.
            .onConflictDoUpdate({
              target: catalogueProgrammes.id,
              set: {
                institutionId: sql`excluded.institution_id`,
                name: sql`excluded.name`,
                department: sql`excluded.department`,
                status: sql`excluded.status`,
                utmeSubjects: sql`excluded.utme_subjects`,
                olevelRequirements: sql`excluded.olevel_requirements`,
                directEntryRequirements: sql`excluded.direct_entry_requirements`,
                remarks: sql`excluded.remarks`,
                sourceUrl: sql`excluded.source_url`,
                sourceUpdatedAt: sql`excluded.source_updated_at`,
              },
            }),
        )
      }

      programmeCount += rows.length
      const programmeTally = perType.get(institutionType)
      if (programmeTally) programmeTally.programmes += rows.length
    }
  }

  const skipped = skippedCount ? ` Skipped ${skippedCount} already imported.` : ''
  const narrowed = schoolNeedles.length
    ? ` Narrowed to ${schoolNeedles.length} named school(s).`
    : ''
  console.log(
    `Imported ${institutionCount} institutions and ${programmeCount} programmes from JAMB IBASS.${skipped}${narrowed}`,
  )

  /**
   * What each named school actually pulled in.
   *
   * `SCHOOL=` is the filter most likely to be given a name that does not exist
   * as written, and the failure is silent — the run reports success and imports
   * nothing for it. Saying how many institutions each name matched is the
   * difference between a typo and a bug, and it also shows when one name is
   * broader than intended.
   */
  if (schoolNeedles.length) {
    console.log('\nNamed schools:')
    for (const needle of schoolNeedles) {
      const matched = matchedCounts.get(needle) ?? 0
      console.log(
        matched
          ? `  ${needle}: ${matched} institution(s)`
          : `  ${needle}: NOTHING MATCHED — check the spelling, or look the name up on /schools`,
      )
    }
  }

  console.log('\nBy institution type:')
  for (const [id, tally] of perType) {
    console.log(
      `  ${typeLabels.get(id)}: ${tally.institutions} institutions, ${tally.programmes} programmes`,
    )
  }

  /**
   * Named outright rather than left to be noticed.
   *
   * This is reported rather than thrown because the import is long and
   * resumable: a type at the end of the list is the one lost when a run is cut
   * short, and that is the ordinary way this goes wrong. Throwing would replace
   * a useful summary with a stack trace at the end of an hour of work, and the
   * operator's next move — run it again with RESUME=1 — is the same either way.
   */
  const empty = [...perType].filter(([, tally]) => tally.institutions === 0)
  if (empty.length) {
    console.warn(
      `\nWARNING: ${empty.length} advertised type(s) imported nothing: ${empty
        .map(([id]) => `${typeLabels.get(id)} (inst_type=${id})`)
        .join(', ')}. The mirror is incomplete — re-run with RESUME=1 to finish it.`,
    )
  }
}

main().catch((error) => {
  // Not "IBASS" — a failure here is at least as likely to be the database, and
  // saying IBASS sent us looking in the wrong place more than once.
  console.error('Catalogue sync failed:', error)
  process.exit(1)
})
