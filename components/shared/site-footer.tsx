import Link from 'next/link'
import { Wordmark } from '@/components/shared/wordmark'

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--color-light-gray)] bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <Wordmark />
            <div className="flex items-center gap-4 text-[0.875rem] text-muted">
              <Link
                href="/design-system"
                className="font-medium text-[var(--color-primary-dark)] underline hover:bg-[var(--color-accent-light)] px-1.5 py-0.5 rounded transition-colors"
              >
                Color System Design Guide (v1.0)
              </Link>
              <span>•</span>
              <span>Deep Charcoal &amp; Fresh Green</span>
            </div>
          </div>
          <p className="max-w-md text-[0.875rem] leading-relaxed text-muted">
            Course requirements, cut-off marks and registration steps shown here are{' '}
            <strong className="font-medium text-foreground">sample data</strong> prepared for a
            demonstration. Always confirm against the current JAMB brochure and your
            institution&rsquo;s own bulletin before you act on anything.
          </p>
        </div>
      </div>
    </footer>
  )
}
