import { GraduationCap } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

import { CheckFlow } from '@/components/eligibility/check-flow'
import { Reveal } from '@/components/shared/reveal'
import { Badge } from '@/components/ui/badge'
import { Arrow } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { findCourse, listCourses } from '@/lib/db/queries'
import { listSubjects } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Check your eligibility',
  description:
    "Enter your O-level subjects and grades and find out whether you meet the requirements for the course you want.",
}

export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>
}) {
  const { course: courseId } = await searchParams
  const course = courseId ? await findCourse(courseId) : undefined

  if (course) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8">
          <Badge tone="primary" className="mb-3">
            {course.institutionShort} &middot; {course.faculty}
          </Badge>
          <h1
            className="text-[2rem] sm:text-[2.5rem]"
            // Receives the morph from the card that opened this page.
            style={{ viewTransitionName: `course-${course.id}` }}
          >
            {course.name}
          </h1>
          <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">{course.blurb}</p>
          <p className="mt-4 rounded-md bg-sunken px-4 py-3 text-[0.9375rem] text-muted">
            <strong className="font-medium text-foreground">What it needs:</strong>{' '}
            {course.olevelRule.minCredits} credits including{' '}
            {listSubjects(course.olevelRule.mandatory)}
            {course.olevelRule.anyOf?.length
              ? `, plus ${course.olevelRule.anyOf[0]?.count} from ${course.olevelRule.anyOf[0]?.label}`
              : ''}
            . A credit means A1 to C6 — D7 and E8 are passes, but they do not count.
          </p>
        </header>

        <CheckFlow course={course} />
      </div>
    )
  }

  const { data: courses, degraded } = await listCourses()

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Reveal>
        <h1 className="text-[2rem] sm:text-[2.5rem]">Which course are you aiming for?</h1>
        <p className="mt-3 max-w-2xl text-[1.0625rem] text-muted">
          Pick one and we&rsquo;ll check your results against exactly what it asks for. You can
          come back and try another at any time.
        </p>
      </Reveal>

      <ul className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c, i) => (
          <Reveal as="li" key={c.id} delay={i * 80}>
            <Link href={`/check?course=${c.id}`} className="group block h-full rounded-lg">
              <Card className="flex h-full flex-col p-6" interactive>
                <div className="flex size-10 items-center justify-center rounded-md bg-[var(--color-primary-dark)] text-[var(--color-accent-light)] shadow-sm">
                  <GraduationCap aria-hidden className="size-5" />
                </div>
                <span className="mt-5 text-[0.8125rem] font-medium uppercase tracking-wide text-muted">
                  {c.institutionShort}
                </span>
                <h2 className="mt-1 text-[1.25rem]" style={{ viewTransitionName: `course-${c.id}` }}>
                  {c.name}
                </h2>
                <p className="mt-2.5 flex-1 text-[0.9375rem] leading-relaxed text-muted">{c.blurb}</p>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[0.875rem]">
                  <span className="text-muted">{c.durationYears} years</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                    Start
                    <Arrow className="size-4" />
                  </span>
                </div>
              </Card>
            </Link>
          </Reveal>
        ))}
      </ul>

      {degraded ? (
        <p className="mt-8 text-center text-[0.8125rem] text-muted">
          Showing the built-in course list. Your results will still be checked correctly.
        </p>
      ) : null}
    </div>
  )
}
