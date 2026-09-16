'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Wordmark } from '@/components/shared/wordmark'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/check', label: 'Check eligibility' },
  { href: '/guide', label: 'Registration guides' },
  { href: '/quiz', label: 'Course fit' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [lifted, setLifted] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300',
        lifted
          ? 'border-border bg-background/80 backdrop-blur-md'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="Admission Copilot — home">
          <Wordmark className="[&_span]:hidden sm:[&_span]:inline" />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-md px-3 py-2 text-[0.9375rem] transition-colors duration-200',
                  active ? 'text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                {item.label}
                {/* Underline grows from the centre rather than fading in. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3 bottom-1 h-px origin-center bg-primary',
                    'transition-transform duration-300 ease-[var(--ease-out-quint)]',
                    active ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <button
            type="button"
            // `.open-chat` is bound by the Swift script's delegated listener.
            className={cn(
              'open-chat h-10 rounded-md border border-border-strong bg-surface px-4',
              'text-[0.9375rem] font-medium transition-colors duration-200',
              'hover:border-primary hover:text-primary',
            )}
          >
            Ask
          </button>
        </div>
      </div>

      {/* Mobile nav: a scrollable rail rather than a hamburger. One tap, not two. */}
      <nav
        className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-sm px-3 py-1.5 text-[0.875rem] transition-colors',
                active ? 'bg-primary-subtle text-primary' : 'text-muted',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
