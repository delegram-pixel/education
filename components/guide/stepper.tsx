'use client'

import { ArrowLeft, BookOpen, Check, CircleHelp, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { AnnotatedShot } from '@/components/guide/annotated-shot'
import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import { Badge } from '@/components/ui/badge'
import { Arrow, Button } from '@/components/ui/button'
import type { Walkthrough } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The walkthrough stepper.
 *
 * Progress is kept in localStorage per walkthrough, so closing the tab
 * mid-registration and coming back does not mean starting over — which is
 * exactly what happens in real life, because half of this process is done
 * standing in a queue at a CBT centre.
 */
export function Stepper({ walkthrough }: { walkthrough: Walkthrough }) {
  const storageKey = `ac-guide-${walkthrough.id}`
  const [index, setIndex] = React.useState(0)
  const [direction, setDirection] = React.useState(1)
  const [restored, setRestored] = React.useState(false)

  React.useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(saved) && saved > 0 && saved < walkthrough.steps.length) {
        setIndex(saved)
      }
    } catch {
      // Private browsing. Starting at step one is a fine outcome.
    }
    setRestored(true)
  }, [storageKey, walkthrough.steps.length])

  React.useEffect(() => {
    if (!restored) return
    try {
      localStorage.setItem(storageKey, String(index))
    } catch {
      // Not persisting progress is survivable; failing to render is not.
    }
  }, [index, restored, storageKey])

  const step = walkthrough.steps[index]
  if (!step) return null

  const total = walkthrough.steps.length
  const isLast = index === total - 1

  function go(next: number) {
    setDirection(next > index ? 1 : -1)
    setIndex(Math.max(0, Math.min(total - 1, next)))
  }

  // Arrow keys move between steps. Guarded so it never hijacks typing.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === 'ArrowRight') go(index + 1)
      if (event.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const slide = direction > 0 ? 'enter-right' : 'enter-left'

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
      {/* ---------------------------------------------------------------- */}
      {/* Rail                                                             */}
      {/* ---------------------------------------------------------------- */}
      <nav aria-label={`${walkthrough.title} steps`} className="lg:sticky lg:top-24 lg:self-start">
        {/* Mobile: a bar, because a nine-item list would eat the screen. */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between text-[0.875rem] text-muted">
            <span>
              Step {index + 1} of {total}
            </span>
            <span>{Math.round(((index + 1) / total) * 100)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[var(--ease-out-quint)]"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <ol className="hidden lg:block">
          {walkthrough.steps.map((s, i) => {
            const done = i < index
            const current = i === index
            return (
              <li key={s.id} className="relative flex gap-3 pb-1">
                {/* The connector, drawn behind the markers. */}
                {i < total - 1 ? (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-[0.6875rem] top-6 h-[calc(100%-0.5rem)] w-px transition-colors duration-500',
                      done ? 'bg-primary' : 'bg-border',
                    )}
                  />
                ) : null}

                <button
                  onClick={() => go(i)}
                  aria-current={current ? 'step' : undefined}
                  className="group flex min-w-0 flex-1 items-start gap-3 rounded-md py-1.5 text-left"
                >
                  <span
                    className={cn(
                      'relative z-10 mt-0.5 grid size-[1.375rem] shrink-0 place-items-center rounded-full',
                      'text-[0.6875rem] font-semibold transition-all duration-300 ease-[var(--ease-spring)]',
                      done && 'bg-primary text-primary-fg',
                      current && 'bg-primary text-primary-fg ring-4 ring-primary/15',
                      !done && !current && 'border border-border bg-surface text-muted',
                    )}
                  >
                    {done ? <Check aria-hidden className="size-3" strokeWidth={3.5} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'text-[0.875rem] leading-snug transition-colors duration-200',
                      current ? 'font-medium text-foreground' : 'text-muted group-hover:text-foreground',
                    )}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* ---------------------------------------------------------------- */}
      {/* Pane                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="min-w-0">
        {/* Keyed on the step id, so changing step remounts the panel and the
            entrance animation replays with the direction of travel. */}
        <article key={step.id} className={slide}>
          <div className="flex items-baseline gap-3">
            <span className="tabular text-[0.875rem] font-medium text-muted lg:hidden">
              {index + 1}/{total}
            </span>
            <h2 className="text-[1.5rem] sm:text-[1.75rem]">{step.title}</h2>
          </div>

          <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">{step.instruction}</p>

          <div className="mt-6">
            <AnnotatedShot
              src={step.screenshotUrl}
              alt={`Step ${step.order}: ${step.title}`}
              hotspot={step.hotspot}
              stepNumber={step.order}
            />
            <p className="mt-2 text-center text-[0.75rem] text-muted">
              Illustrative wireframe — not a screenshot of the real portal.
            </p>
          </div>

          {/* Jargon, defined where it first appears rather than in a glossary
              nobody opens. */}
          {step.defines?.length ? (
            <dl className="mt-6 space-y-3 rounded-md border border-border bg-sunken p-4">
              {step.defines.map((d) => (
                <div key={d.term} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt className="flex shrink-0 items-center gap-1.5 text-[0.875rem] font-semibold sm:w-32">
                    <BookOpen aria-hidden className="size-3.5 text-primary" />
                    {d.term}
                  </dt>
                  <dd className="text-[0.875rem] leading-relaxed text-muted">{d.meaning}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {step.tip ? (
            <div className="mt-5 flex gap-3 rounded-md border border-accent/25 bg-accent-subtle p-4">
              <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <div>
                <p className="text-[0.875rem] font-semibold text-accent">
                  Most people get stuck here
                </p>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-foreground/85">
                  {step.tip}
                </p>
              </div>
            </div>
          ) : null}
        </article>

        {/* Friction point #3: stuck on a specific step. */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <CircleHelp aria-hidden className="size-5 text-primary" />
          <p className="flex-1 text-[0.9375rem] text-muted">
            Screen not looking like this, or something not working?
          </p>
          <AskCopilotButton
            suggestedQuestion={`I'm on "${step.title}" in the ${walkthrough.title} process and I'm stuck. ${step.instruction} What should I do?`}
            label="I'm stuck on this step"
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-6">
          <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>
            <ArrowLeft aria-hidden className="size-4" />
            Back
          </Button>

          {isLast ? (
            <Button asChild className="group">
              <Link href="/guide">
                Finish
                <Check aria-hidden className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button onClick={() => go(index + 1)} className="group">
              Next step
              <Arrow />
            </Button>
          )}
        </div>

        <p className="mt-4 text-center text-[0.8125rem] text-muted">
          <Badge tone="outline" className="mr-2">
            Tip
          </Badge>
          You can use the left and right arrow keys to move between steps.
        </p>
      </div>
    </div>
  )
}
