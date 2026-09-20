'use client'

import { ArrowRight, Check, Compass, ExternalLink, Loader2, Search, X } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { discoverCourses, type DiscoveryState } from '@/app/check/actions'
import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { normaliseSubject, parseSubjects, subjectOptions } from '@/lib/subjects'
import { SUBJECTS, SUBJECT_CODES, subjectName, type SubjectCode } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Course discovery.
 *
 * WHY THIS IS NOT JUST A CHAT PROMPT: the Swift widget exposes no way to send it
 * a message, so "search the catalogue and show me options with links" cannot be
 * delegated to it — whatever it answers goes into a chat panel we cannot read,
 * render, or link from. Searching here means the student gets a real, sourced
 * shortlist in the page, and the chat stays available for the question no search
 * can answer.
 *
 * WHAT IT MUST NEVER SAY: that anyone qualifies. This works from subject names
 * and has no grades, so the strongest true statement is "these programmes list
 * subjects you have". Anything that sounds like a verdict is reserved for the
 * checker, which is why the only assertive control here is a link into it.
 */

const fieldClasses = cn(
  'w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-[1rem]',
  'transition-[border-color,box-shadow] duration-200',
  'placeholder:text-muted/70 hover:border-border-strong',
  'focus:border-primary focus:outline-2 focus:outline-primary focus:ring-2 focus:ring-accent',
)

export function CourseDiscovery() {
  const [selected, setSelected] = React.useState<SubjectCode[]>([])
  const [query, setQuery] = React.useState('')
  const [hint, setHint] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [result, setResult] = React.useState<DiscoveryState>({ status: 'idle' })
  const inputRef = React.useRef<HTMLInputElement>(null)

  /** Subjects matching what is being typed, minus the ones already chosen. */
  const suggestions = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length < 2 || selected.length >= SUBJECT_CODES.length) return []
    return subjectOptions()
      .filter((option) => !selected.includes(option.code))
      .filter((option) => option.name.toLowerCase().includes(needle))
      .slice(0, 5)
  }, [query, selected])

  function add(codes: SubjectCode[]) {
    if (!codes.length) return false
    // Rebuilt in canonical order so the chips do not reshuffle as they are added.
    setSelected((previous) =>
      SUBJECT_CODES.filter((code) => previous.includes(code) || codes.includes(code)),
    )
    setHint(null)
    return true
  }

  /**
   * A whole phrase, not one subject: "Biology and Chemistry" is what a student
   * types, and requiring two separate entries would be our problem, not theirs.
   */
  function addFromText(text: string) {
    if (!add(parseSubjects(text))) {
      setHint(
        text.trim()
          ? `We don't recognise “${text.trim()}” — try the subject name, like Biology or Chemistry.`
          : null,
      )
      return
    }
    setQuery('')
    inputRef.current?.focus()
  }

  function remove(code: SubjectCode) {
    setSelected((previous) => previous.filter((item) => item !== code))
  }

  function search() {
    startTransition(async () => {
      setResult(await discoverCourses(selected))
    })
  }

  const matches = result.status === 'done' ? result.matches : []
  const searched = result.status === 'done'

  const copilotContext = [
    `I have these subjects: ${selected.map(subjectName).join(', ')}.`,
    searched && matches.length
      ? `Searching the admissions catalogue, these programmes list them: ${matches
          .slice(0, 8)
          .map((match) => `${match.programme} at ${match.institution}`)
          .join('; ')}.`
      : null,
    'Which of these should I look at more closely, and what would I need for the ones I do not currently match? Do not tell me I qualify — only the eligibility checker gives a reviewed verdict.',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <section className="mt-8 rounded-xl border border-primary/20 bg-primary-subtle/50 p-5 sm:p-6">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-fg">
          <Compass aria-hidden className="size-4" />
        </span>
        <div>
          <h2 className="text-[1.125rem]">Not sure which course to choose?</h2>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
            Tell us the subjects you have and we&rsquo;ll search the admissions catalogue for
            programmes that list them. This finds options — it does not decide whether you qualify.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Subjects                                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-4">
        <Label htmlFor="discovery-subjects">Subjects you have or plan to take</Label>

        {selected.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {selected.map((code) => (
              <li key={code}>
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-2.5 py-1.5 text-[0.8125rem] font-medium text-primary-fg">
                  {SUBJECTS[code]}
                  <button
                    type="button"
                    onClick={() => remove(code)}
                    aria-label={`Remove ${SUBJECTS[code]}`}
                    className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <input
          id="discovery-subjects"
          ref={inputRef}
          value={query}
          onChange={(event) => {
            const value = event.target.value
            // A comma means the student has finished a subject and moved on.
            if (value.includes(',')) {
              addFromText(value)
              return
            }
            setQuery(value)
            setHint(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (suggestions[0] && query.trim().toLowerCase() === suggestions[0].name.toLowerCase()) {
                add([suggestions[0].code])
                setQuery('')
              } else {
                addFromText(query)
              }
            }
            if (event.key === 'Backspace' && !query && selected.length) {
              remove(selected[selected.length - 1]!)
            }
          }}
          placeholder="Biology and Chemistry"
          className={cn(fieldClasses, 'mt-2')}
          aria-describedby="discovery-hint"
        />

        {suggestions.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((option) => (
              <li key={option.code}>
                <button
                  type="button"
                  onClick={() => {
                    add([option.code])
                    setQuery('')
                    inputRef.current?.focus()
                  }}
                  className="rounded-sm border border-border bg-surface px-2.5 py-1.5 text-[0.8125rem] text-muted transition-colors hover:border-primary hover:text-foreground"
                >
                  + {option.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <p id="discovery-hint" className="mt-2 text-[0.8125rem] text-muted" aria-live="polite">
          {hint ?? 'Separate subjects with a comma or the word “and”.'}
        </p>
      </div>

      <div className="mt-4">
        <Button type="button" onClick={search} disabled={!selected.length || pending}>
          {pending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Search aria-hidden className="size-4" />
          )}
          {pending ? 'Searching' : 'Find courses'}
        </Button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Results                                                           */}
      {/* ---------------------------------------------------------------- */}
      {searched ? (
        <div className="mt-6" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[1.0625rem]">
              {result.total
                ? `${result.total} programme${result.total === 1 ? '' : 's'} list those subjects`
                : 'Nothing in the catalogue lists those subjects yet'}
            </h3>
            <Badge tone={result.source === 'ibass' ? 'success' : 'outline'}>
              {result.source === 'ibass' ? 'JAMB IBASS mirror' : 'Sample catalogue'}
            </Badge>
          </div>

          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            {result.source === 'ibass'
              ? 'Read from the mirrored IBASS brochure. Always confirm the current session in IBASS itself.'
              : 'Three courses have been reviewed by our checker; the rest are unverified sample listings. Requirements and availability change every session — confirm them in IBASS.'}
            {result.total > matches.length
              ? ` Showing the closest ${matches.length} — search again with fewer subjects to narrow it down.`
              : ''}
          </p>

          {matches.length ? (
            <ul className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
              {matches.map((match) => (
                <li
                  key={match.id}
                  className="border-b border-border p-4 last:border-b-0 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-[1.0625rem]">{match.programme}</h4>
                      <p className="mt-0.5 text-[0.8125rem] text-muted">
                        {match.institution}
                        {match.department ? ` · ${match.department}` : ''}
                      </p>
                    </div>
                    <Badge tone={match.reviewedCourseId ? 'success' : 'outline'}>
                      {match.reviewedCourseId ? 'Reviewed by our checker' : 'Unverified listing'}
                    </Badge>
                  </div>

                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {match.utmeSubjects.map((label) => {
                      const code = normaliseSubject(label)
                      const held = code !== null && match.matched.includes(code)
                      return (
                        <li
                          key={label}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[0.8125rem]',
                            held
                              ? 'bg-success-subtle font-medium text-foreground'
                              : 'bg-sunken text-muted',
                          )}
                        >
                          {held ? <Check aria-hidden className="size-3" strokeWidth={3} /> : null}
                          {label}
                        </li>
                      )
                    })}
                  </ul>

                  <p className="mt-2 text-[0.75rem] text-muted">
                    Highlighted subjects are the ones you told us about. UTME subjects are what the
                    programme lists, not a statement that you qualify.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    {match.reviewedCourseId ? (
                      <Button asChild size="sm" className="group">
                        <Link href={`/check?course=${match.reviewedCourseId}`}>
                          Check my results
                          <ArrowRight
                            aria-hidden
                            className="size-4 transition-transform group-hover:translate-x-0.5"
                          />
                        </Link>
                      </Button>
                    ) : null}

                    <Button asChild variant="ghost" size="sm">
                      <a href={match.sourceUrl} target="_blank" rel="noopener noreferrer">
                        Check in IBASS
                        <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-[0.9375rem] text-muted">
              The catalogue may still have something suitable — the Copilot can search more widely and
              a counselor can look properly. Nothing is decided by this search.
            </p>
          )}

          <div className="mt-5">
            <AskCopilotButton
              suggestedQuestion={copilotContext}
              label="Ask about these options"
              fallbackHref="/tickets/new?category=other"
            />
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <AskCopilotButton
            suggestedQuestion={`I want to discover Nigerian university courses. My O-level or intended UTME subjects include: ${
              selected.length ? selected.map(subjectName).join(', ') : '[not entered yet]'
            }. Suggest relevant programmes from the admissions catalogue and cite where each one comes from. Do not tell me I qualify — tell me to verify in current JAMB IBASS and then use the eligibility checker for a reviewed verdict.`}
            label="Explore matching courses"
            fallbackHref="/tickets/new?category=other"
          />
        </div>
      )}
    </section>
  )
}
