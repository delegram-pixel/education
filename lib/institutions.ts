/**
 * Browsing the institution list: grouping and search.
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

export type InstitutionGroup = {
  /** Null when the catalogue records no state for these institutions. */
  state: string | null
  institutions: CatalogueInstitution[]
}

/** Most programmes first, then alphabetically — the fuller records lead. */
function byWeight(a: CatalogueInstitution, b: CatalogueInstitution): number {
  return b.programmeCount - a.programmeCount || a.name.localeCompare(b.name)
}

export function groupByState(institutions: CatalogueInstitution[]): InstitutionGroup[] {
  const groups = new Map<string | null, CatalogueInstitution[]>()

  for (const institution of institutions) {
    // An empty string and a missing state mean the same thing to a reader, so
    // they share one group rather than producing a blank heading and a null one.
    const state = institution.state?.trim() || null
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
 * Institutions matching a typed query, on name, state or type.
 *
 * Returns the input untouched for an empty query, so the caller can pass a
 * half-typed box straight through without a second code path for "no search".
 */
export function searchInstitutions(
  institutions: CatalogueInstitution[],
  query: string,
): CatalogueInstitution[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return institutions

  return institutions.filter(
    (institution) =>
      institution.name.toLowerCase().includes(needle) ||
      (institution.state?.toLowerCase().includes(needle) ?? false) ||
      (institution.institutionType?.toLowerCase().includes(needle) ?? false),
  )
}

/** How many programmes the catalogue lists across these institutions. */
export function programmeTotal(institutions: CatalogueInstitution[]): number {
  return institutions.reduce((sum, institution) => sum + institution.programmeCount, 0)
}
