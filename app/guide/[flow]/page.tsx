import { ArrowLeft, Backpack } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { EpinSafetyNotice } from '@/components/epin/epin-safety-notice'
import { PurchaseChannels } from '@/components/epin/purchase-channels'
import { Stepper } from '@/components/guide/stepper'
import { AdmissionSafetyNotice } from '@/components/shared/admission-safety-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { findWalkthrough, listWalkthroughs } from '@/lib/db/queries'

export async function generateStaticParams() {
  const walkthroughs = await listWalkthroughs()
  return walkthroughs.map((w) => ({ flow: w.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ flow: string }>
}): Promise<Metadata> {
  const { flow } = await params
  const walkthrough = await findWalkthrough(flow)
  if (!walkthrough) return { title: 'Guide not found' }
  return { title: walkthrough.title, description: walkthrough.description }
}

export default async function GuidePage({ params }: { params: Promise<{ flow: string }> }) {
  const { flow } = await params
  const walkthrough = await findWalkthrough(flow)

  if (!walkthrough) notFound()

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link href="/guide">
          <ArrowLeft aria-hidden className="size-4" />
          All guides
        </Link>
      </Button>

      <header className="mb-8">
        <h1 className="text-[2rem] sm:text-[2.5rem]">{walkthrough.title}</h1>
        <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">
          {walkthrough.description}
        </p>

        {/* Shown before the steps, because turning up without one of these is
            the most expensive mistake in the whole process — it costs a trip. */}
        <div className="mt-6 rounded-lg border border-border bg-sunken p-5">
          <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
            <Backpack aria-hidden className="size-4 text-primary" />
            Have these ready before you start
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {walkthrough.bringWithYou.map((item) => (
              <li key={item} className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-muted">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4">
          <Badge tone="outline">
            Illustrative wireframes — not screenshots of the real portal
          </Badge>
        </p>
        <AdmissionSafetyNotice />

        {/* Only the e-PIN walkthrough carries a `purchase` block, so every other
            guide renders exactly as it did before this existed. The channel list
            sits above the steps rather than inside one because the prices and
            addresses are what a student comes back to check, and the stepper is
            keyed to one step at a time. */}
        {walkthrough.purchase ? <PurchaseChannels purchase={walkthrough.purchase} /> : null}
        {walkthrough.purchase ? <EpinSafetyNotice className="mt-4" /> : null}
      </header>

      <Stepper walkthrough={walkthrough} />
    </div>
  )
}
