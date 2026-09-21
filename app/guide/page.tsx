import { Clock, ListChecks } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

import { Reveal } from '@/components/shared/reveal'
import { Arrow } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { listWalkthroughs } from '@/lib/db/queries'

export const metadata: Metadata = {
  title: 'Registration guides',
  description:
    'Step-by-step walkthroughs of JAMB registration, buying your JAMB e-PIN, and UNILAG POST-UTME screening, with the parts people usually get stuck on called out.',
}

export default async function GuideIndexPage() {
  const walkthroughs = await listWalkthroughs()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Reveal>
        <h1 className="text-[2rem] sm:text-[2.5rem]">Registration, one screen at a time</h1>
        <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">
          Each step shows you what the screen is asking for and marks exactly where to click. You
          can stop partway through and pick up where you left off.
        </p>
      </Reveal>

      <ul className="mt-9 grid gap-5 sm:grid-cols-2">
        {walkthroughs.map((w, i) => (
          <Reveal as="li" key={w.id} delay={i * 90}>
            <Link href={`/guide/${w.id}`} className="group block h-full rounded-lg">
              <Card className="flex h-full flex-col p-6" interactive>
                <h2 className="text-[1.25rem]">{w.title}</h2>
                <p className="mt-2.5 flex-1 text-[0.9375rem] leading-relaxed text-muted">
                  {w.description}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-4 text-[0.875rem] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks aria-hidden className="size-4" />
                    {w.steps.length} steps
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden className="size-4" />
                    about {w.estimatedMinutes} min
                  </span>
                </div>

                <span className="mt-5 inline-flex items-center gap-1.5 border-t border-border pt-4 text-[0.875rem] font-medium text-primary">
                  Start the walkthrough
                  <Arrow className="size-4" />
                </span>
              </Card>
            </Link>
          </Reveal>
        ))}
      </ul>
    </div>
  )
}
