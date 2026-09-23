/**
 * Browsing the institution list: grouping, filtering and search.
 *
 * Pure and I/O-free for the same reason `lib/discovery.ts` is — this is the part
 * worth unit-testing, so the reads live in `lib/db/catalogue.ts` and the shaping
 * lives here.
 *
 * WHAT THIS IS NOT: a claim about a school. An institution appears because the
 * catalogue lists it, and the count beside it is how many programmes the
 * catalogue currently holds — not how many the school offers, and not a
 * statement that any of them will admit anyone.
 */

import type { CatalogueInstitution } from '@/lib/db/catalogue'
import { nameKey } from '@/lib/discovery'

export type InstitutionGroup = {
  /** Null when the catalogue records no state for these institutions. */
  state: string | null
  institutions: CatalogueInstitution[]
}

/**
 * What the browse page is currently narrowed to. A null dimension is one the
 * visitor has not touched, which is not the same as one they have set to
 * everything — the page shows no list at all until something is chosen.
 */
export type InstitutionFilters = {
  state: string | null
  type: string | null
  category: string | null
  query: string
}

/** The dimensions a filter can narrow, excluding the free-text query. */
type Dimension = 'state' | 'type' | 'category'

/** One entry in a filter's dropdown, with how many institutions it would show. */
export type FacetOption = { value: string; count: number }

export type InstitutionFacets = {
  state: FacetOption[]
  type: FacetOption[]
  category: FacetOption[]
}

export const NO_FILTERS: InstitutionFilters = {
  state: null,
  type: null,
  category: null,
  query: '',
}

/**
 * The select value standing for "the catalogue records no state".
 *
 * Radix reserves the empty string as an unusable `SelectItem` value, so the
 * unrecorded bucket — which `groupByState` already renders as a real heading,
 * and which would otherwise be the one group of schools no filter could reach —
 * needs a value of its own. Deliberately not a plausible Nigerian state name.
 */
export const UNRECORDED_STATE = '__unrecorded__'

/** Empty and missing are the same thing to a reader, so they normalise together. */
function trimmed(value: string | null): string | null {
  return value?.trim() || null
}

export function recordedState(institution: CatalogueInstitution): string | null {
  return trimmed(institution.state)
}

/** The state filter's value for this row, folding "not recorded" into one bucket. */
function stateOption(institution: CatalogueInstitution): string {
  return recordedState(institution) ?? UNRECORDED_STATE
}

/** How a state option reads once selected — the sentinel is not a state name. */
export function stateOptionLabel(value: string): string {
  return value === UNRECORDED_STATE ? 'State not recorded' : value
}

/** Most programmes first, then alphabetically — the fuller records lead. */
function byWeight(a: CatalogueInstitution, b: CatalogueInstitution): number {
  return b.programmeCount - a.programmeCount || a.name.localeCompare(b.name)
}

export function groupByState(institutions: CatalogueInstitution[]): InstitutionGroup[] {
  const groups = new Map<string | null, CatalogueInstitution[]>()

  for (const institution of institutions) {
    // Recorded through the same helper the filter uses, so the heading a school
    // appears under and the state option that reveals it cannot disagree.
    const state = recordedState(institution)
    const existing = groups.get(state)
    if (existing) existing.push(institution)
    else groups.set(state, [institution])
  }

  return [...groups.entries()]
    .map(([state, items]) => ({ state, institutions: [...items].sort(byWeight) }))
    // Named states alphabetically, unrecorded ones last: a group we cannot place
    // is the least useful thing to open with.
    .sort((a, b) => {
      const left = a.state
      const right = b.state
      if (left === null) return right === null ? 0 : 1
      if (right === null) return -1
      return left.localeCompare(right)
    })
}

/**
 * Whether this institution matches the typed query, ignoring case.
 *
 * The comparison runs on `nameKey` of both sides, not on the raw strings. IBASS
 * writes names the way institutions write them, punctuation and all, and a
 * student types the way people type: "University of Port Harcourt" has to find
 * `UNIVERSITY OF PORT-HARCOURT, RIVERS STATE`, and "Usmanu Danfodiyo" (one
 * space) has to find `USMANU  DANFODIYO UNIVERSITY` (two). A raw substring match
 * finds neither, and a school that cannot be found is indistinguishable from a
 * school that is not there.
 *
 * `needle` is expected to be `nameKey`d already — the callers compute it once
 * for the whole pass rather than per row.
 */
function matchesQuery(institution: CatalogueInstitution, needle: string): boolean {
  return (
    nameKey(institution.name).includes(needle) ||
    nameKey(institution.state ?? '').includes(needle) ||
    nameKey(institution.institutionType ?? '').includes(needle)
  )
}

/**
 * How well a name answers the query. Higher is a better answer.
 *
 * Ranking by programme count alone puts a college of education above the
 * university a student asked for by name — "University of Ibadan" returned
 * seminaries and colleges that merely mention Ibadan, because at the time the
 * mirror held programme counts for those and none for the university. Where the
 * match falls in the name is the signal that does not depend on how far an
 * import has got.
 */
function matchRank(institution: CatalogueInstitution, needle: string): number {
  if (!needle) return 0

  const name = nameKey(institution.name)
  if (name.startsWith(needle)) return 3
  // A space ahead of it means the query begins a word, which is as close to a
  // match on the school's own name as "Ibadan" gets for "University of Ibadan".
  if (name.includes(` ${needle}`)) return 2
  if (name.includes(needle)) return 1
  // Reached only through the state or the type.
  return 0
}

/**
 * Relevance first, then the fuller record.
 *
 * The programme count is what tells "University of Lagos" apart from the twenty
 * other schools with Lagos in the name, so it is kept — but only *within* a rank.
 * Letting it outrank the match put a college of education above the university
 * someone had just named in full, because the mirror held programme counts for
 * the college and none yet for the university.
 */
function byRelevance(
  a: CatalogueInstitution,
  b: CatalogueInstitution,
  needle: string,
): number {
  return matchRank(b, needle) - matchRank(a, needle) || byWeight(a, b)
}


/**
 * Institutions matching a typed query, on name, state or type.
 *
 * Returns the input untouched for an empty query, so the caller can pass a
 * half-typed box straight through without a second code path for "no search".
 */
export function searchInstitutions(
  institutions: CatalogueInstitution[],
  query: string,
): CatalogueInstitution[] {
  const needle = nameKey(query)
  if (!needle) return institutions

  return institutions.filter((institution) => matchesQuery(institution, needle))
}

/**
 * Whether this row survives the active filters.
 *
 * `omit` drops one dimension. Counting a filter's own options has to ignore the
 * value already chosen for it — otherwise the box would only ever offer the
 * states the visitor is already looking at, and selecting one would look like it
 * did nothing.
 */
function matchesFilters(
  institution: CatalogueInstitution,
  filters: InstitutionFilters,
  needle: string,
  omit?: Dimension,
): boolean {
  if (omit !== 'state' && filters.state !== null && stateOption(institution) !== filters.state) {
    return false
  }
  if (omit !== 'type' && filters.type !== null && trimmed(institution.institutionType) !== filters.type) {
    return false
  }
  if (
    omit !== 'category' &&
    filters.category !== null &&
    trimmed(institution.category) !== filters.category
  ) {
    return false
  }

  return !needle || matchesQuery(institution, needle)
}

/**
 * The institutions the current filters select.
 *
 * Returns the input untouched when nothing is set, so "the visitor has not
 * narrowed anything" stays a single check the caller can make rather than a
 * filter pass that happens to be lossless.
 */
export function filterInstitutions(
  institutions: CatalogueInstitution[],
  filters: InstitutionFilters,
): CatalogueInstitution[] {
  if (!hasActiveFilters(filters)) return institutions

  const needle = nameKey(filters.query)
  return institutions.filter((institution) => matchesFilters(institution, filters, needle))
}

/**
 * The options each filter should offer, with the count it would show.
 *
 * Counts are computed against the *other* active filters, so the number beside
 * an option is what selecting it actually produces. A count taken over the whole
 * catalogue would promise 62 schools and then show 8 once the type filter applied.
 *
 * Options come from the rows, never from a constant list: IBASS supplies state,
 * type and ownership, and the offline sample supplies neither ownership nor more
 * than one type — so the ownership box simply has no options to render rather
 * than existing but being wrong.
 */
export function institutionFacets(
  institutions: CatalogueInstitution[],
  filters: InstitutionFilters,
): InstitutionFacets {
  const needle = nameKey(filters.query)

  return {
    state: facetOptions(institutions, filters, needle, 'state', stateOption, compareStates),
    type: facetOptions(institutions, filters, needle, 'type', (row) => trimmed(row.institutionType)),
    category: facetOptions(institutions, filters, needle, 'category', (row) => trimmed(row.category)),
  }
}

function facetOptions(
  institutions: CatalogueInstitution[],
  filters: InstitutionFilters,
  needle: string,
  dimension: Dimension,
  value: (institution: CatalogueInstitution) => string | null,
  compare: (a: FacetOption, b: FacetOption) => number = byCount,
): FacetOption[] {
  const counts = new Map<string, number>()

  for (const institution of institutions) {
    if (!matchesFilters(institution, filters, needle, dimension)) continue

    const key = value(institution)
    if (key === null) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([option, count]) => ({ value: option, count }))
    .sort(compare)
}

/** Busiest first — an ownership or type filter is chosen for its size. */
function byCount(a: FacetOption, b: FacetOption): number {
  return b.count - a.count || a.value.localeCompare(b.value)
}

/** Alphabetical, matching the state headings, with the unrecorded bucket last. */
function compareStates(a: FacetOption, b: FacetOption): number {
  if (a.value === UNRECORDED_STATE) return b.value === UNRECORDED_STATE ? 0 : 1
  if (b.value === UNRECORDED_STATE) return -1
  return a.value.localeCompare(b.value)
}

/**
 * Whether the visitor has narrowed anything.
 *
 * Drives both the prompt shown in place of the list and whether a reset is
 * offered, so those two can never disagree about what "unfiltered" means. A
 * whitespace-only query is not a filter — it selects nothing and reads as an
 * empty box.
 */
export function hasActiveFilters(filters: InstitutionFilters): boolean {
  return (
    filters.state !== null ||
    filters.type !== null ||
    filters.category !== null ||
    filters.query.trim() !== ''
  )
}

/** How many programmes the catalogue lists across these institutions. */
export function programmeTotal(institutions: CatalogueInstitution[]): number {
  return institutions.reduce((sum, institution) => sum + institution.programmeCount, 0)
}

/**
 * The schools the checker has a reviewed course at, keyed the way institution
 * names are matched everywhere else.
 *
 * A school can be in the mirror without any reviewed programme — most are — and
 * the difference decides whether picking it can lead anywhere but IBASS. Keyed by
 * `nameKey` so it agrees with the programme-level match in `readProgrammes`,
 * which is what actually resolves a catalogue row to a reviewed course.
 */
export function reviewedInstitutionKeys(courses: { institution: string }[]): Set<string> {
  return new Set(courses.map((course) => nameKey(course.institution)))
}

/** Whether the checker can decide on a course this school teaches. */
export function isReviewedInstitution(
  institution: CatalogueInstitution,
  reviewedKeys: ReadonlySet<string>,
): boolean {
  return reviewedKeys.has(nameKey(institution.name))
}

/** A school as the search offers it, carrying whether the checker has a course there. */
export type InstitutionSuggestion = {
  institution: CatalogueInstitution
  reviewed: boolean
}

export type InstitutionSuggestions = {
  reviewed: InstitutionSuggestion[]
  listings: InstitutionSuggestion[]
  /** How many schools matched, before the display cap. */
  total: number
}

/**
 * The schools to offer for a query, the reviewed ones separated out.
 *
 * Two groups rather than one sorted list, because the difference is not a
 * ranking nicety: a reviewed school has a course the checker can return a
 * verdict on, and everywhere else the only next step is to go and read IBASS. A
 * student should not have to infer which is which from a programme count.
 *
 * `limit` caps what is rendered, not what is matched — the caller is told `total`
 * so it can say how many it is not showing. The reviewed group is served first
 * and is never crowded out by the listings.
 */
export function suggestInstitutions(
  institutions: CatalogueInstitution[],
  filters: InstitutionFilters,
  reviewedKeys: ReadonlySet<string>,
  limit = 40,
): InstitutionSuggestions {
  const needle = nameKey(filters.query)

  const matched = filterInstitutions(institutions, filters)
    .map((institution) => ({
      institution,
      reviewed: isReviewedInstitution(institution, reviewedKeys),
    }))
    // An empty query has no relevance to judge, so the fullest records lead —
    // that is what makes the untouched dropdown a useful starting list. Once
    // something has been typed, the name is the query and the name decides.
    .sort(
      (a, b) =>
        Number(b.reviewed) - Number(a.reviewed) ||
        (needle
          ? byRelevance(a.institution, b.institution, needle)
          : byWeight(a.institution, b.institution)),
    )

  const reviewed = matched.filter((entry) => entry.reviewed)
  const listings = matched.filter((entry) => !entry.reviewed)

  return {
    reviewed: reviewed.slice(0, limit),
    listings: listings.slice(0, Math.max(0, limit - reviewed.length)),
    total: matched.length,
  }
}

/* -------------------------------------------------------------------------- */
/* Choosing a school and a course to check                                     */
/* -------------------------------------------------------------------------- */

/**
 * The fields a picker needs from a reviewed course.
 *
 * Narrower than `Course` on purpose. The O-level rule, the UTME rule and the
 * persona profile are what a verdict is made of, and none of them belong in a
 * dropdown option or in the payload that carries it to the browser. A `Course`
 * satisfies this, so a caller can pass one straight through.
 */
export type ReviewedCourse = {
  id: string
  name: string
  institution: string
  institutionShort: string
  faculty: string
}

/**
 * IBASS's public brochure — the source every catalogue row points at, including
 * the ones we write ourselves.
 */
const BROCHURE_URL = 'https://ibass.jamb.gov.ng/brochure-by-institution'

/**
 * The catalogue, plus any school that has a reviewed course but is missing from
 * it.
 *
 * The two sets are not the same, and the gap is not hypothetical: the mirror is
 * built from IBASS's `/inst-type` list, so a school we have reviewed can be
 * absent — either because IBASS publishes it under a type the sync did not
 * reach, or because a run stopped before it got there. A school the checker can
 * decide on has to remain findable regardless, or the checker cannot be used for
 * the one thing it is for.
 *
 * `details` supplies a state and type for a school the catalogue does not carry.
 * Passed in rather than imported so this module stays free of the data files:
 * the caller has them, and a pure helper should not reach for them.
 */
export function withReviewedInstitutions(
  institutions: CatalogueInstitution[],
  courses: ReviewedCourse[],
  details: Record<string, { state: string; institutionType: string }> = {},
): CatalogueInstitution[] {
  const known = new Set(institutions.map((institution) => nameKey(institution.name)))

  // Counted per school so the row can say how many courses we hold for it, which
  // is the same thing `programmeCount` means for a mirrored row.
  const missing = new Map<string, { name: string; count: number }>()
  for (const course of courses) {
    const key = nameKey(course.institution)
    if (known.has(key)) continue
    const existing = missing.get(key)
    if (existing) existing.count += 1
    else missing.set(key, { name: course.institution, count: 1 })
  }

  if (!missing.size) return institutions

  const extra: CatalogueInstitution[] = [...missing].map(([key, entry]) => {
    const detail = details[entry.name]
    return {
      id: `reviewed:${key}`,
      name: entry.name,
      institutionType: detail?.institutionType ?? null,
      // Ownership is IBASS's to state and we have no basis for guessing it.
      category: null,
      state: detail?.state ?? null,
      sourceUrl: BROCHURE_URL,
      // Epoch is this codebase's existing way of saying "not from IBASS" — see
      // the sample rows in `lib/db/catalogue.ts`.
      sourceUpdatedAt: new Date(0),
      programmeCount: entry.count,
    }
  })

  return [...institutions, ...extra]
}

/** One programme as the catalogue lists it. Structural, so a caller's row fits. */
export type CatalogueProgrammeRow = {
  programme: string
  department: string | null
  utmeSubjects: string[]
  sourceUrl: string
  reviewedCourseId: string | null
}

/** One course as the picker offers it. */
export type SchoolCourse = {
  /** Stable option key — the reviewed course id where there is one. */
  key: string
  name: string
  department: string | null
  utmeSubjects: string[]
  sourceUrl: string
  /** Non-null when the checker can return a verdict on this course. */
  reviewedCourseId: string | null
}

/**
 * The courses one school offers, as the checker's second step offers them.
 *
 * The union of two sources that do not agree. The catalogue lists what the
 * school teaches; the reviewed courses are the ones we can decide on, and a
 * school can have reviewed courses the catalogue does not carry — the mirror
 * holding no programmes for a school is a gap in the import, not a statement
 * that the school teaches nothing. `readProgrammes` returns an empty list rather
 * than substituting sample rows to make exactly that point, so the union is
 * assembled here instead of being assumed downstream.
 *
 * Where both carry the same course the reviewed entry wins: it is the one that
 * leads somewhere, and offering the same course twice — once checkable, once not
 * — is a worse answer than either.
 */
export function coursesForInstitution(
  programmes: CatalogueProgrammeRow[],
  courses: ReviewedCourse[],
  institutionName: string,
): SchoolCourse[] {
  const key = nameKey(institutionName)

  const reviewed: SchoolCourse[] = courses
    .filter((course) => nameKey(course.institution) === key)
    .map((course) => ({
      key: course.id,
      name: course.name,
      department: course.faculty,
      utmeSubjects: [],
      sourceUrl: BROCHURE_URL,
      reviewedCourseId: course.id,
    }))

  const reviewedNames = new Set(reviewed.map((course) => nameKey(course.name)))

  const listings: SchoolCourse[] = programmes
    .filter((programme) => !reviewedNames.has(nameKey(programme.programme)))
    .map((programme) => ({
      key: `listing:${nameKey(programme.programme)}`,
      name: programme.programme,
      department: programme.department,
      utmeSubjects: programme.utmeSubjects,
      sourceUrl: programme.sourceUrl,
      // A catalogue row can resolve to a reviewed course by name even when the
      // two spell the programme differently; that link is already made upstream
      // and is carried through rather than recomputed.
      reviewedCourseId: programme.reviewedCourseId,
    }))

  // Reviewed first — they are the reason the checker exists, and the one course
  // a student can act on should not sit in the middle of ninety listings. Within
  // the listings, the checkable ones lead for the same reason.
  return [
    ...reviewed.sort(byCourseName),
    ...listings.sort(
      (a, b) =>
        Number(Boolean(b.reviewedCourseId)) - Number(Boolean(a.reviewedCourseId)) ||
        byCourseName(a, b),
    ),
  ]
}

function byCourseName(a: SchoolCourse, b: SchoolCourse): number {
  return a.name.localeCompare(b.name)
}

