import { cn } from '@/lib/utils'

/**
 * The mark is a route: two waypoints joined by a path that turns.
 *
 * Not a graduation cap. Every education product uses a graduation cap, and this
 * product is not about graduating — it is about finding your way through a
 * process that is badly signposted.
 */
export function Wordmark({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" className="fill-primary" />
        <path
          d="M9 22.5c0-4.5 4-4.5 7-4.5s7 0 7-4.5"
          fill="none"
          stroke="currentColor"
          className="text-primary-fg"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeDasharray="0.1 4.6"
        />
        <circle cx="9" cy="22.5" r="2.6" className="fill-primary-fg" />
        <circle cx="23" cy="9.5" r="3.4" className="fill-accent" />
      </svg>
      {showText ? (
        <span className="font-display text-[1.0625rem] font-semibold tracking-tight">
          Admission Copilot
        </span>
      ) : null}
    </span>
  )
}
