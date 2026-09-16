'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Reveals children when they scroll into view.
 *
 * Uses IntersectionObserver rather than a scroll listener, and unobserves after
 * firing, so a long page does not accumulate work. Children are visible by
 * default and only hidden once JS confirms the observer is running — without
 * that, a failed hydration would leave the page permanently blank.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'section' | 'li' | 'article'
}) {
  const ref = React.useRef<HTMLElement>(null)
  const [shown, setShown] = React.useState(false)
  const [armed, setArmed] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }

    setArmed(true)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cn(
        armed && 'transition-[opacity,transform] duration-[650ms] ease-[var(--ease-out-quint)]',
        armed && !shown && 'translate-y-4 opacity-0',
        className,
      )}
      style={armed ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
