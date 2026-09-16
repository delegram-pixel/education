import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { VerdictCard } from '@/components/eligibility/verdict-card'
import { Badge } from '@/components/ui/badge'
import { Arrow, Button } from '@/components/ui/button'
import { findCheck, findCourse } from '@/lib/db/queries'

export const metadata: Metadata = {
  title: 'A shared eligibility result',
  robots: { index: false },
}

/**
 * A shared result.
 *
 * The share link exists because the person who most needs to see a verdict is
 * often not the person who produced it — it goes to a parent, an older sibling,
 * or a teacher. The page is deliberately not indexed.
 */
export default async function SharedResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const check = await findCheck(id)

  if (!check) notFound()

  const course = await findCourse(check.courseId)
  if (!course) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link href="/">
          <ArrowLeft aria-hidden className="size-4" />
          Admission Copilot
        </Link>
      </Button>

      <div className="mb-7">
        <Badge tone="primary">Shared result</Badge>
        <h1 className="mt-3 text-[1.75rem] sm:text-[2rem]">
          {course.name} at {course.institutionShort}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-muted">
          Checked on{' '}
          {check.createdAt.toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          .
        </p>
      </div>

      <VerdictCard verdict={check.verdict} course={course} shareId={null} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-sunken px-5 py-4">
        <p className="text-[0.9375rem] text-muted">Want to check your own results?</p>
        <Button asChild size="sm" className="group">
          <Link href="/check">
            Start a check
            <Arrow className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
