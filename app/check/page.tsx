import type { Metadata } from 'next'

import { CheckFlow } from '@/components/eligibility/check-flow'
import { SchoolCoursePicker } from '@/components/eligibility/school-course-picker'
import { AdmissionSafetyNotice } from '@/components/shared/admission-safety-notice'
import { CourseDiscovery } from '@/components/swift/course-discovery'
import { Reveal } from '@/components/shared/reveal'
import { Badge } from '@/components/ui/badge'
import { SAMPLE_INSTITUTION_DETAILS } from '@/lib/db/catalogue.data'
import { listInstitutions } from '@/lib/db/catalogue'
import { findCheckTarget, listCourses } from '@/lib/db/queries'
import { reviewedInstitutionKeys, withReviewedInstitutions } from '@/lib/institutions'
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
  const course = courseId ? await findCheckTarget(courseId) : null

  if (course) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Badge tone="primary">
              {course.institutionShort}
              {course.faculty ? ` · ${course.faculty}` : ''}
            </Badge>
          </div>
          <h1
            className="text-[2rem] sm:text-[2.5rem]"
            // Receives the shared transition from the course list where supported.
            style={{ viewTransitionName: `course-${course.id}` }}
          >
            {course.name}
          </h1>
          {/* Only a course we have written up has a description. A rule read out
              of the brochure says nothing about what the course is like, and
              writing one would be describing something we have not looked at. */}
          {course.blurb ? (
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">{course.blurb}</p>
          ) : null}
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

  const [{ data: courses, degraded }, { institutions }] = await Promise.all([
    listCourses(),
    listInstitutions(),
  ])

  // The catalogue plus any school we have reviewed a course at but IBASS has not
  // mirrored. Without this the one school the checker can decide on can be the
  // one school it cannot offer.
  const schools = withReviewedInstitutions(institutions, courses, SAMPLE_INSTITUTION_DETAILS)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Reveal>
        <h1 className="text-[2rem] sm:text-[2.5rem]">Choose your school and course</h1>
        <p className="mt-3 max-w-2xl text-[1.0625rem] text-muted">
          Pick the school you have in mind, then the course you want to check. We can give you a
          verdict on the courses we have reviewed; the rest are listings, and we say so rather than
          guess.
        </p>
      </Reveal>

      <Reveal>
        <AdmissionSafetyNotice className="mt-6" />
      </Reveal>

      <Reveal>
        <SchoolCoursePicker
          institutions={schools}
          reviewedKeys={[...reviewedInstitutionKeys(courses)]}
          reviewedCourses={courses}
        />
      </Reveal>

      <Reveal delay={90}>
        <CourseDiscovery />
      </Reveal>

      {degraded ? (
        <p className="mt-8 text-center text-[0.8125rem] text-muted">
          Showing the built-in course list. Your results will still be checked correctly.
        </p>
      ) : null}
    </div>
  )
}
