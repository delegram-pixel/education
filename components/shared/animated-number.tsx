'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A number that counts to its target rather than jumping.
 *
 * Uses requestAnimationFrame with an eased curve. The element is marked
 * `tabular` so the digits do not reflow while counting — a tally that jitters
 * while it climbs looks broken, however smooth the easing.
 */
export function AnimatedNumber({
  value,
  duration = 520,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = React.useState(value)
  const from = React.useRef(value)

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      from.current = value
      return
    }

    const start = performance.now()
    const origin = from.current
    const delta = value - origin
    if (delta === 0) return

    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutQuint, matching --ease-out-quint elsewhere.
      const eased = 1 - Math.pow(1 - t, 5)
      setDisplay(Math.round(origin + delta * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className={cn('tabular', className)}>{display}</span>
}
