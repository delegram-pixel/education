'use client'

import { ArrowLeft, Info, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { AnimatedNumber } from '@/components/shared/animated-number'
import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import { Badge } from '@/components/ui/badge'
import { Arrow, Button } from '@/components/ui/button'
import { savePersona } from '@/app/quiz/actions'
import { QUIZ_QUESTIONS } from '@/lib/persona/questions'
import { alignmentBand, alignmentNote, alignmentScore, scoreAnswers } from '@/lib/persona/scoring'
import type { Course } from '@/lib/types'
import { cn } from '@/lib/utils'

const BAND_STYLE = {
  strong: { label: 'Strong fit', bar: 'bg-success', text: 'text-success', wash: 'bg-success-subtle' },
  reasonable: { label: 'Reasonable fit', bar: 'bg-primary', text: 'text-primary', wash: 'bg-primary-subtle' },
  worth_thinking_about: {
    label: 'Worth thinking about',
    bar: 'bg-warning',
    text: 'text-warning',
    wash: 'bg-warning-subtle',
  },
} as const

export function QuizFlow({ courses }: { courses: Course[] }) {
  const [answers, setAnswers] = React.useState<Record<string, number>>({})
  const [index, setIndex] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const [direction, setDirection] = React.useState(1)

  const question = QUIZ_QUESTIONS[index]
  const total = QUIZ_QUESTIONS.length

  function answer(value: number) {
    if (!question) return
    setAnswers((current) => ({ ...current, [question.id]: value }))
    setDirection(1)

    // A short pause so the selection is visibly registered before the card
    // moves. Advancing instantly reads as the app skipping your answer.
    window.setTimeout(() => {
      if (index + 1 >= total) setDone(true)
      else setIndex(index + 1)
    }, 260)
  }

  const results = React.useMemo(() => {
    if (!done) return null
    const profile = scoreAnswers(answers)
    const scored = courses
      .map((course) => {
        const score = alignmentScore(profile, course.personaProfile)
        return { course, score, band: alignmentBand(score), note: alignmentNote(score, profile, course) }
      })
      .sort((a, b) => b.score - a.score)

    return { profile, scored }
  }, [done, answers, courses])

  React.useEffect(() => {
    if (!results) return
    void savePersona({
      answers,
      profile: results.profile,
      alignmentByCourse: Object.fromEntries(results.scored.map((r) => [r.course.id, r.score])),
    })
    // Persisting once, when results first appear. `answers` is frozen by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])

  /* ---------------------------------------------------------------------- */
  /* Results                                                                */
  /* ---------------------------------------------------------------------- */

  if (results) {
    return (
      <div className="animate-settle">
        <h2 className="text-[1.75rem] sm:text-[2rem]">How these three line up with you</h2>
        <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">
          This is about fit, not qualification. It has no bearing on whether you meet a
          course&rsquo;s requirements, and it is not a recommendation — you know things about
          yourself that eight questions cannot reach.
        </p>

        <ul className="mt-8 space-y-4">
          {results.scored.map(({ course, score, band, note }, i) => {
            const style = BAND_STYLE[band]
            return (
              <li
                key={course.id}
                className="animate-settle rounded-lg border border-border bg-surface p-6 shadow-card"
                style={{ animationDelay: `${i * 110}ms` }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted">
                      {course.institutionShort}
                    </span>
                    <h3 className="text-[1.25rem]">{course.name}</h3>
                  </div>
                  <span className={cn('text-[1.5rem] font-semibold', style.text)}>
                    <AnimatedNumber value={score} duration={900} />
                    <span className="text-[0.9375rem] font-normal text-muted">/100</span>
                  </span>
                </div>

                <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-sunken">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-[1100ms] ease-[var(--ease-out-quint)]',
                      style.bar,
                    )}
                    style={{ width: `${score}%`, transitionDelay: `${i * 110 + 120}ms` }}
                  />
                </div>

                <p className={cn('mt-2.5 inline-block rounded-sm px-2 py-0.5 text-[0.8125rem] font-medium', style.wash, style.text)}>
                  {style.label}
                </p>

                <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{course.reality}</p>

                {/* The advisory. Non-blocking by construction: it is a
                    paragraph inside a card, below the score, and the button
                    beneath it is identical for every band. */}
                {note ? (
                  <div className="mt-4 flex gap-3 rounded-md border border-warning/25 bg-warning-subtle p-4">
                    <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                    <div>
                      <p className="text-[0.9375rem] leading-relaxed text-foreground/90">{note}</p>
                      <p className="mt-2 text-[0.8125rem] text-muted">
                        This is guidance, not a decision. The choice stays yours.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
                  <Button asChild size="sm" className="group">
                    <Link href={`/check?course=${course.id}`}>
                      Check my results for this
                      <Arrow className="size-4" />
                    </Link>
                  </Button>
                  {note ? (
                    <AskCopilotButton
                      suggestedQuestion={`I'm thinking about ${course.name} at ${course.institutionShort}. ${note} Can you talk me through whether that matters?`}
                      label="Talk this through"
                    />
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
          <Button
            variant="ghost"
            onClick={() => {
              setAnswers({})
              setIndex(0)
              setDone(false)
            }}
          >
            <RotateCcw aria-hidden className="size-4" />
            Take it again
          </Button>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------------- */
  /* Questions                                                              */
  /* ---------------------------------------------------------------------- */

  if (!question) return null

  const slide = direction > 0 ? 'enter-below' : 'enter-above'

  const selected = answers[question.id]

  return (
    <div>
      {/* Progress as dots: eight is few enough to count, and seeing all eight
          at once tells the student this is short. */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {QUIZ_QUESTIONS.map((q, i) => (
            <span
              key={q.id}
              className={cn(
                'h-1.5 rounded-full transition-all duration-500 ease-[var(--ease-out-quint)]',
                i === index ? 'w-6 bg-primary' : answers[q.id] ? 'w-1.5 bg-primary/45' : 'w-1.5 bg-border',
              )}
            />
          ))}
        </div>
        <span className="tabular text-[0.875rem] text-muted">
          {index + 1} of {total}
        </span>
      </div>

      {/* Keyed on the question id: changing question remounts this block and
          replays the entrance in the direction of travel. */}
      <div key={question.id} className={cn('mt-6', slide)}>
        <fieldset>
          <legend className="font-display text-[1.375rem] leading-snug sm:text-[1.625rem]">
            {question.prompt}
          </legend>

          <div className="mt-7 space-y-2.5">
            {question.scale.map((label, i) => {
              const value = i + 1
              const isSelected = selected === value
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => answer(value)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-center gap-3.5 rounded-md border px-4 py-3.5 text-left',
                    'transition-[border-color,background-color,transform] duration-200',
                    'hover:border-primary hover:bg-primary-subtle/50',
                    'active:scale-[0.99]',
                    isSelected ? 'border-primary bg-primary-subtle' : 'border-border bg-surface',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200',
                      isSelected ? 'border-primary' : 'border-border-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'size-2.5 rounded-full bg-primary transition-transform duration-300 ease-[var(--ease-spring)]',
                        isSelected ? 'scale-100' : 'scale-0',
                      )}
                    />
                  </span>
                  <span className="text-[1.0625rem]">{label}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button
          variant="ghost"
          disabled={index === 0}
          onClick={() => {
            setDirection(-1)
            setIndex(Math.max(0, index - 1))
          }}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Button>
        <Badge tone="outline" className="max-w-full text-center">Nothing here affects your eligibility</Badge>
      </div>
    </div>
  )
}
