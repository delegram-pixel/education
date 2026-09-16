'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'Match my device' },
  { value: 'dark', icon: Moon, label: 'Dark' },
]

/**
 * A three-state segmented control with a pill that slides between options.
 *
 * Three states, not two: "system" is the default and must remain reachable, so
 * a visitor who has explicitly chosen light can get back to following their
 * device. A binary toggle silently makes that a one-way door.
 */
export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>('system')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('ac-theme')
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {
      // Storage can be unavailable in a private window. System default is fine.
    }
  }, [])

  function apply(next: Theme) {
    setTheme(next)
    try {
      if (next === 'system') {
        localStorage.removeItem('ac-theme')
        document.documentElement.removeAttribute('data-theme')
      } else {
        localStorage.setItem('ac-theme', next)
        document.documentElement.setAttribute('data-theme', next)
      }
    } catch {
      // Preference is not persisted, but the current page still switches.
      if (next !== 'system') document.documentElement.setAttribute('data-theme', next)
    }
  }

  const activeIndex = OPTIONS.findIndex((o) => o.value === theme)

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="relative flex items-center gap-0.5 rounded-md border border-border bg-sunken p-0.5"
    >
      {/* The travelling pill. Transform-only, so it never triggers layout. */}
      <span
        aria-hidden
        className={cn(
          'absolute left-0.5 top-0.5 size-8 rounded-[0.4rem] bg-surface shadow-card',
          'transition-transform duration-[350ms] ease-[var(--ease-spring)]',
          !mounted && 'opacity-0',
        )}
        style={{ transform: `translateX(calc(${Math.max(activeIndex, 0)} * (2rem + 0.125rem)))` }}
      />
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => apply(value)}
          className={cn(
            'relative z-10 grid size-8 place-items-center rounded-[0.4rem]',
            'transition-colors duration-200',
            theme === value ? 'text-primary' : 'text-muted hover:text-foreground',
          )}
        >
          <Icon aria-hidden className="size-[1.05rem]" />
        </button>
      ))}
    </div>
  )
}
