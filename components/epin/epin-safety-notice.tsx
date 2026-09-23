import { ShieldAlert } from 'lucide-react'

import { EPIN_SAFETY_POINTS } from '@/lib/swift/safety'
import { cn } from '@/lib/utils'

/**
 * The scams that cluster around buying an e-PIN.
 *
 * WHY THIS IS NOT `AdmissionSafetyNotice`. That notice renders the three rules
 * that hold everywhere — check deadlines, open portals yourself, never hand over
 * an OTP — and it appears on every page. These four rules are only true on the
 * one screen where a student is about to send money somewhere, and adding them
 * app-wide would lengthen a notice students already scroll past, making the
 * three that *do* apply everywhere easier to ignore. Scope is what keeps a
 * warning worth reading. The points themselves live in `lib/swift/safety.ts`
 * next to the others, so there is still one place to read them all.
 *
 * SAME TONE AS THE APP-WIDE NOTICE, on purpose. A student who has seen the
 * orange panel on the checker should recognise this as the same class of
 * warning rather than a new thing to skim. The heading and the points carry the
 * extra weight; the styling should not be doing the alarming.
 */
export function EpinSafetyNotice({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        'rounded-lg border border-warning/30 bg-warning-subtle px-5 py-4',
        className,
      )}
    >
      <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-foreground">
        <ShieldAlert aria-hidden className="size-4 shrink-0 text-warning" />
        Buying an e-PIN is where students lose money
      </h2>
      <ul className="mt-2 space-y-1.5 text-[0.875rem] leading-relaxed text-muted">
        {EPIN_SAFETY_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </aside>
  )
}
