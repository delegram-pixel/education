'use client'

import { Check, X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The hero visual: a result slip that resolves itself.
 *
 * This is not decoration. It teaches, in about eight seconds and without a
 * sentence of explanation, the single fact most students get wrong — that a D7
 * is a pass but not a credit, and that a re-sit at a second sitting fixes it
 * without costing you the subjects you already passed.
 *
 * The sequence: five rows stamp in, the verdict lands amber at four credits,
 * the Physics grade flips from D7 to C4, the tally ticks to five, and the
 * verdict turns green. Then it rests, and repeats.
 *
 * Under `prefers-reduced-motion` the whole thing renders as a static slip in
 * its resolved state — the information survives, the movement does not.
 */

type Row = { subject: string; grade: string; credit: boolean }

const ROWS: Row[] = [
  { subject: 'English Language', grade: 'B2', credit: true },
  { subject: 'Mathematics', grade: 'B3', credit: true },
  { subject: 'Biology', grade: 'A1', credit: true },
  { subject: 'Chemistry', grade: 'B2', credit: true },
  { subject: 'Physics', grade: 'D7', credit: false },
]

const RESIT_GRADE = 'C4'

/** Timeline in milliseconds, cumulative from the start of a cycle. */
const BEAT = {
  rowStep: 240,
  verdict: 1500,
  flip: 3100,
  resolved: 3700,
  restart: 7600,
} as const

export function ResultSlip() {
  const [phase, setPhase] = React.useState<'stamping' | 'partial' | 'flipping' | 'resolved'>(
    'stamping',
  )
  const [visibleRows, setVisibleRows] = React.useState(0)
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true)
      setVisibleRows(ROWS.length)
      setPhase('resolved')
      return
    }

    const timers: number[] = []

    const run = () => {
      setVisibleRows(0)
      setPhase('stamping')

      ROWS.forEach((_, i) => {
        timers.push(window.setTimeout(() => setVisibleRows(i + 1), BEAT.rowStep * (i + 1)))
      })
      timers.push(window.setTimeout(() => setPhase('partial'), BEAT.verdict))
      timers.push(window.setTimeout(() => setPhase('flipping'), BEAT.flip))
      timers.push(window.setTimeout(() => setPhase('resolved'), BEAT.resolved))
      timers.push(window.setTimeout(run, BEAT.restart))
    }

    run()
    return () => timers.forEach(window.clearTimeout)
  }, [])

  const flipped = phase === 'flipping' || phase === 'resolved'
  const credits = flipped ? 5 : Math.min(visibleRows, 4)
  const resolved = phase === 'resolved'

  return (
    <div
      className="relative w-full max-w-sm select-none"
      // The slip animates on a loop and carries no information the page does
      // not also state in text. Announcing it would be noise.
      aria-hidden
    >
      {/* Two offset sheets behind the slip: it reads as paper, not a panel. */}
      <div className="absolute inset-x-3 -bottom-2 h-full rounded-lg border border-border bg-surface/60" />
      <div className="absolute inset-x-1.5 -bottom-1 h-full rounded-lg border border-border bg-surface/80" />

      <div className="relative rounded-lg border border-border bg-surface p-5 shadow-lifted">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border pb-3">
          <span className="font-display text-[0.9375rem] font-semibold">O&rsquo;level results</span>
          <span className="tabular text-[0.8125rem] text-muted">
            <span
              className={cn(
                'inline-block transition-transform duration-300 ease-[var(--ease-spring)]',
                flipped && 'scale-125 text-success',
              )}
            >
              {credits}
            </span>
            <span> of 5 credits</span>
          </span>
        </div>

        <ul className="divide-y divide-border">
          {ROWS.map((row, i) => {
            const shown = i < visibleRows
            const isPhysics = row.subject === 'Physics'
            const grade = isPhysics && flipped ? RESIT_GRADE : row.grade
            const credit = isPhysics ? flipped : row.credit

            return (
              <li
                key={row.subject}
                className={cn(
                  'flex items-center justify-between gap-3 py-2.5 text-[0.9375rem]',
                  'transition-[opacity,transform] duration-300 ease-[var(--ease-out-quint)]',
                  shown ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
                )}
              >
                <span className="truncate text-muted">{row.subject}</span>

                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'tabular grid h-7 w-9 place-items-center rounded-sm text-[0.875rem] font-semibold',
                      'transition-colors duration-500',
                      // The flip. One axis, half a turn, backface hidden.
                      isPhysics && 'duration-500 [transform-style:preserve-3d]',
                      isPhysics && flipped && !reduced && '[transform:rotateX(360deg)]',
                      credit
                        ? 'bg-success-subtle text-success'
                        : 'bg-warning-subtle text-warning',
                    )}
                    style={
                      isPhysics && !reduced
                        ? { transition: 'transform 600ms var(--ease-spring), background-color 400ms, color 400ms' }
                        : undefined
                    }
                  >
                    {grade}
                  </span>
                  <span
                    className={cn(
                      'grid size-5 place-items-center rounded-full transition-colors duration-500',
                      credit ? 'bg-success text-white' : 'bg-warning/20 text-warning',
                    )}
                  >
                    {credit ? (
                      <Check aria-hidden className="size-3.5" strokeWidth={3} />
                    ) : (
                      <X aria-hidden className="size-3.5" strokeWidth={3} />
                    )}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>

        {/* The verdict strip. Height is fixed so nothing below it ever shifts. */}
        <div className="mt-3 h-[3.25rem] overflow-hidden rounded-md">
          <div
            className={cn(
              'flex h-full flex-col transition-transform duration-500 ease-[var(--ease-out-quint)]',
              phase === 'stamping' && '-translate-y-full',
              resolved && 'translate-y-full',
            )}
            style={{ transform: resolved ? 'translateY(-200%)' : undefined }}
          >
            <div className="grid h-[3.25rem] shrink-0 place-items-center bg-sunken text-[0.875rem] text-muted">
              Checking against Medicine &amp; Surgery&hellip;
            </div>
            <div className="grid h-[3.25rem] shrink-0 place-items-center bg-warning-subtle px-3 text-center text-[0.875rem] font-medium text-warning">
              One subject away — you need a credit in Physics
            </div>
            <div className="grid h-[3.25rem] shrink-0 place-items-center bg-success-subtle px-3 text-center text-[0.875rem] font-medium text-success">
              You meet every O&rsquo;level requirement
            </div>
          </div>
        </div>

        <p
          className={cn(
            'mt-2.5 text-center text-[0.75rem] leading-snug text-muted',
            'transition-opacity duration-500',
            resolved ? 'opacity-100' : 'opacity-0',
          )}
        >
          A re-sit counts alongside your first sitting. Nothing you passed is wasted.
        </p>
      </div>
    </div>
  )
}
