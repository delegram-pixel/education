'use client'

import { ArrowRight, Building2, GraduationCap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Course } from '@/lib/types'

/**
 * School and programme are selected together. The course itself owns the
 * institution, so this never lets a student choose a school that the selected
 * course does not belong to.
 */
export function CoursePicker({ courses }: { courses: Course[] }) {
  const router = useRouter()
  const institutions = React.useMemo(
    () =>
      Array.from(
        new Map(courses.map((course) => [course.institution, course])).values()).map((course) => ({
        name: course.institution,
        short: course.institutionShort,
      })),
    [courses],
  )
  const [institution, setInstitution] = React.useState(institutions[0]?.name ?? '')
  const availableCourses = courses.filter((course) => course.institution === institution)
  const [courseId, setCourseId] = React.useState(availableCourses[0]?.id ?? '')
  const course = courses.find((item) => item.id === courseId)

  function pickInstitution(value: string) {
    setInstitution(value)
    setCourseId(courses.find((course) => course.institution === value)?.id ?? '')
  }

  function continueToCheck() {
    if (courseId) router.push(`/check?course=${courseId}`)
  }

  return (
    <div className="mt-9 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="grid border-b border-border bg-sunken p-5 sm:grid-cols-2 sm:gap-5 sm:p-7">
        <label className="block">
          <span className="flex items-center gap-2 text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-muted">
            <Building2 aria-hidden className="size-4 text-primary" />
            1. Choose a school
          </span>
          <Select value={institution} onValueChange={pickInstitution}>
            <SelectTrigger className="mt-3 h-12 bg-background">
              <SelectValue placeholder="Choose an institution" />
            </SelectTrigger>
            <SelectContent>
              {institutions.map((item) => (
                <SelectItem key={item.name} value={item.name} hint={item.short}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="mt-5 block sm:mt-0">
          <span className="flex items-center gap-2 text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-muted">
            <GraduationCap aria-hidden className="size-4 text-primary" />
            2. Choose a course
          </span>
          <Select value={courseId} onValueChange={setCourseId} disabled={!availableCourses.length}>
            <SelectTrigger className="mt-3 h-12 bg-background">
              <SelectValue placeholder="Choose a course" />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map((item) => (
                <SelectItem key={item.id} value={item.id} hint={`${item.durationYears} years`}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {course ? (
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
          <div>
            <p className="text-[0.8125rem] font-medium uppercase tracking-[0.1em] text-muted">
              {course.institutionShort} · {course.durationYears} years
            </p>
            <h2 className="mt-1 text-[1.375rem]">{course.name}</h2>
            <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">{course.blurb}</p>
          </div>
          <Button type="button" size="lg" onClick={continueToCheck} className="group justify-self-start sm:justify-self-end">
            Check my results
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
