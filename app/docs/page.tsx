import type { Metadata } from 'next'
import Link from 'next/link'
import { Arrow } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'API documentation',
  description: 'Reference documentation for the Admission Copilot APIs.',
}

/**
 * The docs index.
 *
 * One card today. It exists as its own route rather than letting the catalogue
 * reference sit at `/docs` so that a second API page can be added without
 * moving a URL an integrator has already bookmarked.
 */
export default function DocsIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-[2rem] sm:text-[2.5rem]">API documentation</h1>
      <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">
        The APIs behind Admission Copilot, written for the people building against them — not for
        the people signing off on the integration. Each reference covers authentication, the
        response envelope, pagination, errors and limits.
      </p>

      <ul className="mt-9 grid gap-5 sm:grid-cols-2">
        <li>
          <Link href="/docs/catalogue-api" className="group block h-full rounded-lg">
            <Card className="flex h-full flex-col p-6" interactive>
              <h2 className="text-[1.25rem]">Catalogue API</h2>
              <p className="mt-2.5 flex-1 text-[0.9375rem] leading-relaxed text-muted">
                Read-only access to the admissions catalogue: institutions, programmes, UTME
                subject combinations, and the requirement prose JAMB&rsquo;s IBASS e-brochure
                publishes.
              </p>

              <span className="mt-5 inline-flex items-center gap-1.5 border-t border-border pt-4 text-[0.875rem] font-medium text-primary">
                Read the reference
                <Arrow className="size-4" />
              </span>
            </Card>
          </Link>
        </li>
      </ul>
    </div>
  )
}
