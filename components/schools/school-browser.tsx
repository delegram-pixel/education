'use client'

import { ArrowRight, ExternalLink, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { loadInstitutionProgrammes, type InstitutionProgrammesState } from '@/app/schools/actions'
import { SchoolCombobox } from '@/components/schools/school-combobox'
import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CatalogueInstitution } from '@/lib/db/catalogue'
import {
  filterInstitutions,
  hasActiveFilters,
  institutionFacets,
  isReviewedInstitution,
  NO_FILTERS,
  stateOptionLabel,
  type FacetOption,
  type InstitutionFilters,
} from '@/lib/institutions'

/**
 * Browse the national catalogue by school.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE CHECKER: the eligibility picker offers only
 * the handful of courses we have reviewed well enough to decide on. A student who
 * does not yet know what they want needs the other end — the whole country, with
 * a source link for each entry — and needs it to be obvious that browsing is not
 * a verdict. So nothing here decides anything: a reviewed programme offers a link
 * into the checker, and everything else offers IBASS and stops.
 *
 * THE SEARCH IS THE LIST. The catalogue is national — hundreds of schools and
 * thousands of programmes — so rendering it as rows makes a student scroll before
 * they have said what they want. The combobox opens on the schools worth seeing
 * first and narrows as they type; the filters below it narrow that same set. One
 * school is shown at a time, and its programmes load on demand.
 */

export function SchoolBrowser({
  institutions,
  reviewedKeys,
}: {
  institutions: CatalogueInstitution[]
  /** Name keys of the institutions the checker has a reviewed course at. */
  reviewedKeys: string[]
}) {
  const reviewed = React.useMemo(() => new Set(reviewedKeys), [reviewedKeys])

  const [filters, setFilters] = React.useState<InstitutionFilters>(NO_FILTERS)
  const [selected, setSelected] = React.useState<CatalogueInstitution | null>(null)
  const [result, setResult] = React.useState<InstitutionProgrammesState | null>(null)
  const [pending, startTransition] = React.useTransition()

  // Picking a second school while the first is still loading leaves two requests
  // in flight. The panel shows one school at a time, so the later pick has to win
  // — otherwise a slow lookup for the previous school lands under this one's name.
  const requestId = React.useRef(0)

  const facets = React.useMemo(
    () => institutionFacets(institutions, filters),
    [institutions, filters],
  )
  const matched = React.useMemo(
    () => filterInstitutions(institutions, filters),
    [institutions, filters],
  )

  // Narrowing the filters does not clear the chosen school: it was asked for by
  // name, and dropping it because a control below moved would undo a deliberate
  // action. Clear filters is the way to reset.
  function narrow(patch: Partial<InstitutionFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function clearFilters() {
    setFilters(NO_FILTERS)
  }

  function choose(institution: CatalogueInstitution | null) {
    const id = (requestId.current += 1)
    setSelected(institution)

    // Collapsing should not leave the previous school's programmes in state,
    // where they would render under whichever school is picked next.
    setResult(null)
    if (!institution) return

    startTransition(async () => {
      const next = await loadInstitutionProgrammes(institution.name)
      if (id === requestId.current) setResult(next)
    })
  }

  const narrowed = hasActiveFilters(filters)

  return (
    <section className="mt-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="school-search">Search schools</Label>
          <SchoolCombobox
            institutions={institutions}
            filters={filters}
            reviewedKeys={reviewed}
            selected={selected}
            onSelect={choose}
          />
        </div>

        {/* Only offered when the catalogue can populate them. A dimension with a
            single value is not a filter, and the sample fallback carries no
            category at all — so offline these collapse rather than render a
            dropdown with nothing to choose. */}
        {facets.state.length >= 1 ? (
          <FacetSelect
            id="school-state"
            label="State"
            placeholder="Choose a state"
            options={facets.state}
            value={filters.state}
            format={stateOptionLabel}
            onChange={(value) => narrow({ state: value })}
          />
        ) : null}

        {/* Labels follow the values IBASS actually returns, not the field names.
            `institution_type` is ND or NCE — the award an institution is listed
            under, not "university" or "polytechnic" — and `category` carries
            ownership and kind together ("FEDERAL POLYTECHNICS"), so calling it
            ownership would name only half of what the option says. */}
        {facets.type.length >= 2 ? (
          <FacetSelect
            id="school-type"
            label="Award level"
            placeholder="Any award level"
            options={facets.type}
            value={filters.type}
            onChange={(value) => narrow({ type: value })}
          />
        ) : null}

        {facets.category.length >= 2 ? (
          <FacetSelect
            id="school-category"
            label="Category"
            placeholder="Any category"
            options={facets.category}
            value={filters.category}
            onChange={(value) => narrow({ category: value })}
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p id="school-count" className="text-[0.8125rem] text-muted" aria-live="polite">
          {narrowed
            ? `${matched.length} of ${institutions.length} institutions match these filters.`
            : `${institutions.length} institutions in the catalogue.`}
        </p>

        {narrowed ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <X aria-hidden className="size-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {selected ? (
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-[1.0625rem]">{selected.name}</h2>
              <p className="mt-0.5 text-[0.8125rem] text-muted">
                {selected.programmeCount} programme{selected.programmeCount === 1 ? '' : 's'} listed
                {selected.state ? ` · ${selected.state}` : ''}
                {selected.institutionType ? ` · ${selected.institutionType}` : ''}
              </p>
            </div>
            <Badge tone={isReviewedInstitution(selected, reviewed) ? 'success' : 'outline'}>
              {isReviewedInstitution(selected, reviewed)
                ? 'Reviewed by our checker'
                : 'Unverified listing'}
            </Badge>
          </div>

          <ProgrammePanel state={result} pending={pending} />
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-[0.9375rem] leading-relaxed text-muted">
          Search for a school above, or narrow by state, award level or category, then pick one to
          see the programmes it lists.
        </p>
      )}

      <div className="mt-8">
        <AskCopilotButton
          suggestedQuestion="I am browsing the Nigerian institution catalogue and do not know where to start. Help me narrow down which schools and programmes to consider, and say where each answer comes from. Do not tell me I qualify — tell me to verify in the current JAMB IBASS, then use the eligibility checker for a reviewed verdict."
          label="Not sure where to start?"
          counselorHref="/tickets/new?category=other"
        />
      </div>
    </section>
  )
}

/**
 * One narrowing dropdown, with the count each option would show.
 *
 * The count comes from `institutionFacets`, which computes it against the other
 * active filters — so it is what selecting the option actually produces rather
 * than a catalogue-wide total that the next click would contradict.
 */
function FacetSelect({
  id,
  label,
  placeholder,
  options,
  value,
  format,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  options: FacetOption[]
  value: string | null
  /** How an option value reads to a person, when the value is not already it. */
  format?: (value: string) => string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {/* Radix reserves the empty string as an item value, so "not chosen" has no
          item: the root takes `''`, which `shouldShowPlaceholder` renders as the
          placeholder. Passing `undefined` instead would flip the select between
          controlled and uncontrolled the moment Clear filters ran. */}
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} hint={String(option.count)}>
              {format ? format(option.value) : option.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ProgrammePanel({
  state,
  pending,
}: {
  state: InstitutionProgrammesState | null
  pending: boolean
}) {
  if (pending || !state) {
    return (
      <p className="flex items-center gap-2.5 bg-sunken px-4 py-4 text-[0.9375rem] text-muted sm:px-5">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Loading programmes&hellip;
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p className="bg-sunken px-4 py-4 text-[0.9375rem] text-muted sm:px-5">{state.message}</p>
    )
  }

  if (!state.programmes.length) {
    return (
      <p className="bg-sunken px-4 py-4 text-[0.9375rem] leading-relaxed text-muted sm:px-5">
        The catalogue holds no programme detail for this school yet — that is a gap in what we have
        imported, not a statement that it offers nothing. Check the institution in the JAMB IBASS
        brochure.
      </p>
    )
  }

  return (
    <ul className="bg-sunken" aria-live="polite">
      {state.programmes.map((programme) => (
        <li key={programme.programme} className="border-b border-border p-4 last:border-b-0 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-medium text-foreground">{programme.programme}</h3>
              {programme.department ? (
                <p className="mt-0.5 text-[0.8125rem] text-muted">{programme.department}</p>
              ) : null}
            </div>
            <Badge tone={programme.reviewedCourseId ? 'success' : 'outline'}>
              {programme.reviewedCourseId ? 'Reviewed by our checker' : 'Unverified listing'}
            </Badge>
          </div>

          {programme.utmeSubjects.length ? (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {programme.utmeSubjects.map((label) => (
                <li
                  key={label}
                  className="rounded-sm bg-surface px-2 py-1 text-[0.8125rem] text-muted"
                >
                  {label}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {programme.reviewedCourseId ? (
              <Button asChild size="sm" className="group">
                <Link href={`/check?course=${programme.reviewedCourseId}`}>
                  Check my results
                  <ArrowRight
                    aria-hidden
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </Button>
            ) : null}

            <Button asChild variant="ghost" size="sm">
              <a href={programme.sourceUrl} target="_blank" rel="noopener noreferrer">
                Check in IBASS
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
