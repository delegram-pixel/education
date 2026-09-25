'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/** Space kept between the bubble and the edge of the screen. */
const GUTTER = 8

/**
 * The bubble's geometry, set here rather than by a utility class because both
 * values are answers to the same question — how much room is there.
 *
 * `max-width` is capped against the screen as well as at 18rem: a bubble wider
 * than the screen cannot be placed anywhere that fits it. The shift rides in a
 * custom property so the centred position stays the declared one and `place`
 * only ever nudges it.
 */
const BUBBLE_STYLE: React.CSSProperties = {
  maxWidth: `min(18rem, calc(100vw - ${GUTTER * 2}px))`,
  transform: 'translateX(calc(-50% + var(--tip-shift, 0px)))',
}

/**
 * A hint that appears under whatever it is attached to.
 *
 * WHY THIS MEASURES INSTEAD OF JUST CENTRING. The bubble is `absolute` and
 * centred on its trigger, which is right for a control in the middle of a page
 * and wrong for one near the edge. The header's controls sit at the right of
 * the viewport, and a bubble centred under the last of them hangs past it:
 * 18rem is 288px, and centring that on a trigger 316px along a 375px screen
 * puts 85px of it off the side.
 *
 * That overhang does not merely clip the hint. The bubble is `opacity-0` until
 * hover, and **invisible is not absent** — it is still a box in the document,
 * so it counts towards the scrollable width, and the whole page slides
 * sideways under a thumb. Anchoring to the trigger's trailing edge instead
 * would trade that for the same fault on the leading edge, and CSS has no way
 * to ask which side has room. So the bubble is placed where centring would put
 * it and then slid back inside, which is the one thing pure CSS cannot express
 * and the whole reason this component measures.
 *
 * The measurement runs when the bubble is about to be seen — on hover, on
 * focus, and on resize — rather than only on mount, because what it measures
 * against is the width of the text, and the webfont that decides that width
 * can land after mount.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: string
  children: React.ReactNode
  className?: string
}) {
  const bubble = React.useRef<HTMLSpanElement>(null)

  const place = React.useCallback(() => {
    const node = bubble.current
    // The wrapper is the bubble's containing block, so its rect is the trigger.
    const trigger = node?.parentElement
    if (!node || !trigger) return

    // `offsetWidth` is the laid-out width, untouched by the shift below.
    const width = node.offsetWidth
    const box = trigger.getBoundingClientRect()
    const centred = box.left + box.width / 2 - width / 2

    const furthest = document.documentElement.clientWidth - width - GUTTER
    const left = Math.max(GUTTER, Math.min(centred, Math.max(furthest, GUTTER)))

    node.style.setProperty('--tip-shift', `${Math.round(left - centred)}px`)
  }, [])

  React.useEffect(() => {
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [place])

  return (
    <span
      className={cn('group relative inline-flex', className)}
      // Synchronous, so the shift lands in the same style recalculation that
      // reveals the bubble and it is never painted at the centred position.
      onPointerEnter={place}
      onFocus={place}
    >
      {children}
      <span
        ref={bubble}
        role="tooltip"
        style={BUBBLE_STYLE}
        className={cn(
          'pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max',
          'rounded-md border border-border bg-surface px-3 py-2 text-center text-xs font-medium leading-relaxed text-foreground shadow-lifted',
          'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {content}
      </span>
    </span>
  )
}
