'use client'

import { ArrowRight, ChevronDown, ExternalLink, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { loadInstitutionProgrammes, type InstitutionProgrammesState } from '@/app/schools/actions'
import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { CatalogueInstitution } from '@/lib/db/catalogue'
import { groupByState, searchInstitutions } from '@/lib/institutions'
import { cn } from '@/lib/utils'

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
 * Programmes load on demand. The catalogue runs to hundreds of institutions and
 * thousands of programmes; shipping all of it to render one school would cost
 * megabytes to answer a question about a single row.
 */

const fieldClasses = cn(
  'w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-[1rem]',
  'transition-[border-color,box-shadow] duration-200',
  'placeholder:text-muted/70 hover:border-border-strong',
  'focus:border-primary focus:outline-2 focus:outline-primary focus:ring-2 focus:ring-accent',
)

export function SchoolBrowser({ institutions }: { institutions: CatalogueInstitution[] }) {
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<InstitutionProgrammesState | null>(null)
  const [pending, startTransition] = React.useTransition()

  const filtered = React.useMemo(
    () => searchInstitutions(institutions, query),
    [institutions, query],
  )
  const groups = React.useMemo(() => groupByState(filtered), [filtered])

  function toggle(name: string) {
    // Collapsing should not leave the previous school's programmes in state,
    // where they would flash under whichever row opens next.
    if (open === name) {
      setOpen(null)
      setResult(null)
      return
    }

    setOpen(name)
    setResult(null)
    startTransition(async () => {
      setResult(await loadInstitutionProgrammes(name))
    })
  }

  return (
    <section className="mt-8">
      <Label htmlFor="school-search">Search schools</Label>

      <div className="relative mt-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
        <input
          id="school-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Lagos, Ibadan, University of…"
          className={cn(fieldClasses, 'pl-10')}
          aria-describedby="school-count"
        />
      </div>

      <p id="school-count" className="mt-2 text-[0.8125rem] text-muted" aria-live="polite">
        {filtered.length === institutions.length
          ? `All ${institutions.length} institutions in the catalogue.`
          : `${filtered.length} of ${institutions.length} institutions match.`}
      </p>

      {groups.length ? (
        <div className="mt-6 space-y-8">
          {groups.map((group) => (
            <section key={group.state ?? 'unrecorded'}>
              <h2 className="text-[1.0625rem]">{group.state ?? 'State not recorded'}</h2>

              <ul className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
                {group.institutions.map((institution) => {
                  const expanded = open === institution.name

                  return (
                    <li key={institution.id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggle(institution.name)}
                        aria-expanded={expanded}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent-subtle sm:px-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {institution.name}
                          </span>
                          <span className="mt-0.5 block text-[0.8125rem] text-muted">
                            {institution.programmeCount} programme
                            {institution.programmeCount === 1 ? '' : 's'} listed
                            {institution.institutionType
                              ? ` · ${institution.institutionType}`
                              : ''}
                          </span>
                        </span>
                        <ChevronDown
                          aria-hidden
                          className={cn(
                            'size-4 shrink-0 text-muted transition-transform duration-200',
                            expanded && 'rotate-180',
                          )}
                        />
                      </button>

                      {expanded ? <ProgrammePanel state={result} pending={pending} /> : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-[0.9375rem] text-muted">
          Nothing in the catalogue matches &ldquo;{query.trim()}&rdquo;. It may still list the
          school under a different name — the Copilot can search more widely, and a counselor can
          look properly.
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

function ProgrammePanel({
  state,
  pending,
}: {
  state: InstitutionProgrammesState | null
  pending: boolean
}) {
  if (pending || !state) {
    return (
      <p className="flex items-center gap-2.5 border-t border-border bg-sunken px-4 py-4 text-[0.9375rem] text-muted sm:px-5">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Loading programmes&hellip;
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p className="border-t border-border bg-sunken px-4 py-4 text-[0.9375rem] text-muted sm:px-5">
        {state.message}
      </p>
    )
  }

  if (!state.programmes.length) {
    return (
      <p className="border-t border-border bg-sunken px-4 py-4 text-[0.9375rem] leading-relaxed text-muted sm:px-5">
        The catalogue holds no programme detail for this school yet — that is a gap in what we have
        imported, not a statement that it offers nothing. Check the institution in the JAMB IBASS
        brochure.
      </p>
    )
  }

  return (
    <ul className="border-t border-border bg-sunken" aria-live="polite">
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
