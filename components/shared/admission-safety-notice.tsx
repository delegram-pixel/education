import { ShieldCheck } from 'lucide-react'

import { SAFETY_POINTS } from '@/lib/swift/safety'
import { cn } from '@/lib/utils'

/**
 * The deadline and scam warning.
 *
 * Rendered at every point where a student is about to *do* something — start a
 * registration, read a verdict, pick a course — rather than once in a footer
 * nobody scrolls to. The rules themselves live in `lib/swift/safety.ts`, because
 * the same three have to reach Swift with every question the app asks; keeping
 * one copy is what stops the notice promising something the assistant is no
 * longer told.
 *
 * `compact` is for placements inside an existing card, where the full-size
 * version would read as a second page rather than an aside.
 */
export function AdmissionSafetyNotice({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <aside
      className={cn(
        'rounded-lg border border-warning/30 bg-warning-subtle',
        compact ? 'px-4 py-3.5' : 'px-5 py-4',
        className,
      )}
    >
      <h2
        className={cn(
          'flex items-center gap-2 font-semibold text-foreground',
          compact ? 'text-[0.875rem]' : 'text-[0.9375rem]',
        )}
      >
        <ShieldCheck aria-hidden className={cn('shrink-0 text-warning', compact ? 'size-3.5' : 'size-4')} />
        Protect your admission details
      </h2>
      <ul
        className={cn(
          'text-muted',
          compact
            ? 'mt-2 space-y-1 text-[0.8125rem] leading-relaxed'
            : 'mt-2 space-y-1.5 text-[0.875rem] leading-relaxed',
        )}
      >
        {SAFETY_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </aside>
  )
}
