'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as React from 'react'

import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Wordmark } from '@/components/shared/wordmark'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/check', label: 'Check eligibility' },
  { href: '/guide', label: 'Registration guides' },
  { href: '/quiz', label: 'Course fit' },
  // { href: '/design-system', label: 'Color System Guide' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [lifted, setLifted] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleAsk() {
    if (typeof window !== 'undefined' && window.SwiftAgentWidget?.open) {
      window.SwiftAgentWidget.open()
      return
    }

    router.push('/tickets/new')
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300',
        lifted
          ? 'border-border bg-background/85 backdrop-blur-md'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="Admission Copilot — home">
          <Wordmark className="[&_span]:hidden sm:[&_span]:inline" />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-md px-3.5 py-2 text-[0.9375rem] font-medium transition-colors duration-200',
                  'hover:bg-accent-subtle',
                  active ? 'text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                {item.label}
                {/* Active tab underline in Fresh Green #FFFFC0 per Guide Page 3 & 5 */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3 bottom-0.5 h-[2px] origin-center rounded-full bg-[var(--color-accent-light)]',
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
            onClick={handleAsk}
            className={cn(
              'open-chat h-10 rounded-md border border-border bg-surface px-4',
              'text-[0.9375rem] font-medium transition-colors duration-200',
              'hover:border-primary hover:bg-accent hover:text-primary-fg',
            )}
            aria-label="Ask a counselor or open the chat widget"
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
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-[0.875rem] font-medium transition-colors',
                active
                    ? 'bg-primary text-primary-fg'
                    : 'text-muted hover:text-foreground hover:bg-accent-subtle',
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
