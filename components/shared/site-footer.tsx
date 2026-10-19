import Link from 'next/link'

import { Wordmark } from '@/components/shared/wordmark'

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <Wordmark />
            <Link
              href="/docs"
              className="w-fit text-[0.875rem] text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              API documentation
            </Link>
          </div>
          <p className="min-w-0 max-w-md text-[0.875rem] leading-relaxed text-muted">
            Course requirements, cut-off marks and registration steps shown here are based on{' '}
            <strong className="font-medium text-foreground">verified reference data</strong> and
            published guidance. Always confirm against the current JAMB brochure and your
            institution&rsquo;s own bulletin before you act on anything.
          </p>
        </div>
      </div>
    </footer>
  )
}
