import type { Metadata } from 'next'

import { CheckFlow } from '@/components/eligibility/check-flow'
import { CoursePicker } from '@/components/eligibility/course-picker'
import { Reveal } from '@/components/shared/reveal'
import { Badge } from '@/components/ui/badge'
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Badge tone="primary">{course.institutionShort} &middot; {course.faculty}</Badge>
          </div>
          <h1
            className="text-[2rem] sm:text-[2.5rem]"
            // Receives the shared transition from the course list where supported.
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
        <h1 className="text-[2rem] sm:text-[2.5rem]">Choose your school and course</h1>
        <p className="mt-3 max-w-2xl text-[1.0625rem] text-muted">
          Choose the institution first, then the course you want to check. We&rsquo;ll only show
          courses that belong to that school.
        </p>
      </Reveal>

      <Reveal>
        <CoursePicker courses={courses} />
      </Reveal>

      {degraded ? (
        <p className="mt-8 text-center text-[0.8125rem] text-muted">
          Showing the built-in course list. Your results will still be checked correctly.
        </p>
      ) : null}
    </div>
  )
}
