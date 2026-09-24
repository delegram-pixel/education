'use client'

import { ArrowRight, Building2, ExternalLink, GraduationCap, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { loadInstitutionProgrammes, readCourseRule, type InstitutionProgrammesState } from '@/app/schools/actions'
import { SchoolCombobox } from '@/components/schools/school-combobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CatalogueInstitution } from '@/lib/db/catalogue'
import {
  coursesForInstitution,
  NO_FILTERS,
  type CatalogueProgrammeRow,
  type ReviewedCourse,
  type SchoolCourse,
} from '@/lib/institutions'

/**
 * Step one: a school. Step two: a course that school offers.
 *
 * WHY THE SCHOOL LIST IS THE WHOLE CATALOGUE: the checker used to derive its
 * school list from the courses we have reviewed, which is one institution — a
 * dropdown with a single option, which reads as a bug and is useless to anyone
 * who does not already study there. A student knows which school they are
 * thinking of; asking them to name it is the right first question, and the
 * answer should be the country, not our backlog.
 *
 * WHY STEP TWO IS A UNION: the catalogue lists what a school teaches and the
 * reviewed courses are the ones we can decide on, and the two sets do not
 * coincide. See `coursesForInstitution` — the point is that a reviewed course is
 * always offered, even when the catalogue holds nothing for that school.
 *
 * WHAT IT MUST NOT DO: imply a verdict it cannot give. A course we have reviewed
 * links into the checker; a course we have not offers the official record and
 * says plainly that we have not reviewed it. The check button is simply absent
 * rather than present and disabled, because a disabled control still reads as
 * "this would work if you did something differently".
 *
 * WHERE THE READ HAPPENS: picking a course nobody has read a rule for is the
 * signal the whole feature is built on — the student is looking at this course
 * now, so this is the one worth spending a read on. The panel says so while it
 * is happening and swaps in the check button when it lands. A course whose
 * brochure sentence we already read is answered from storage, and one whose
 * sentence says nothing countable is settled for good and is never re-read.
 */

/** Stable identity for "this school's programmes have not loaded". */
const NO_PROGRAMMES: CatalogueProgrammeRow[] = []

/** What the picker knows about reading a rule for the course on screen. */
type ReadState = {
  /** The course key this answer belongs to, so a stale one is never shown. */
  key: string
  state: 'reading' | 'ready' | 'unavailable'
}

export function SchoolCoursePicker({
  institutions,
  reviewedKeys,
  reviewedCourses,
}: {
  institutions: CatalogueInstitution[]
  /** Name keys of the institutions the checker has a reviewed course at. */
  reviewedKeys: string[]
  reviewedCourses: ReviewedCourse[]
}) {
  const router = useRouter()
  const reviewed = React.useMemo(() => new Set(reviewedKeys), [reviewedKeys])

  const [school, setSchool] = React.useState<CatalogueInstitution | null>(null)
  const [loaded, setLoaded] = React.useState<InstitutionProgrammesState | null>(null)
  const [courseKey, setCourseKey] = React.useState('')
  const [readState, setReadState] = React.useState<ReadState | null>(null)
  const [pending, startTransition] = React.useTransition()

  // Picking a second school while the first is still loading leaves two requests
  // in flight; the later pick has to win, or the earlier school's programmes land
  // under this one's name.
  const requestId = React.useRef(0)

  function pickSchool(next: CatalogueInstitution | null) {
    const id = (requestId.current += 1)
    setSchool(next)
    setLoaded(null)
    setCourseKey('')
    if (!next) return

    startTransition(async () => {
      const result = await loadInstitutionProgrammes(next.name)
      if (id === requestId.current) setLoaded(result)
    })
  }

  const programmes = loaded?.status === 'done' ? loaded.programmes : NO_PROGRAMMES

  const courses = React.useMemo(
    () => coursesForInstitution(programmes, reviewedCourses, school?.name ?? ''),
    [programmes, reviewedCourses, school],
  )

  // Land on the first course rather than an empty step two. The student has said
  // which school; leaving the panel blank would make them wonder whether it
  // worked.
  React.useEffect(() => {
    setCourseKey(courses[0]?.key ?? '')
  }, [courses])

  const course = courses.find((entry) => entry.key === courseKey) ?? null
  const noDetail =
    school !== null && !pending && courses.length === 0 && loaded?.status === 'done'

  const programmeId = course?.programmeId ?? null
  const storedRule = course?.ruleStatus ?? null

  /**
   * Programmes this tab has already read a rule for.
   *
   * The server has them stored, so asking again would only cost a round trip —
   * but it would also flash the reading state at a student who has already
   * waited once, which reads as the first read having not worked.
   */
  const alreadyRead = React.useRef(new Set<string>())

  React.useEffect(() => {
    // Nothing to read: no course, no catalogue row behind it, or a rule the
    // server already holds — answered successfully or settled as unreadable.
    if (!courseKey || !programmeId || storedRule !== null) {
      setReadState(null)
      return
    }

    if (alreadyRead.current.has(programmeId)) {
      setReadState({ key: courseKey, state: 'ready' })
      return
    }

    let cancelled = false
    setReadState({ key: courseKey, state: 'reading' })

    void readCourseRule(programmeId).then((result) => {
      if (cancelled) return
      if (result.status === 'ready') alreadyRead.current.add(programmeId)
      setReadState({ key: courseKey, state: result.status === 'ready' ? 'ready' : 'unavailable' })
    })

    // A student who moves to another course while this is in flight must not
    // have the first course's answer land under the second one's name.
    return () => {
      cancelled = true
    }
  }, [courseKey, programmeId, storedRule])

  // The id the checker can decide on. A reviewed course is decided by the rule
  // we wrote by hand; a catalogue row is decided by the rule once it has been
  // read. Anything else has no verdict to offer and falls back to the brochure.
  const checkableId =
    course?.reviewedCourseId ??
    (programmeId && (storedRule === 'ready' || readState?.state === 'ready') ? programmeId : null)

  const reading =
    course?.reviewedCourseId === null &&
    programmeId !== null &&
    storedRule === null &&
    readState?.key === courseKey &&
    readState.state === 'reading'

  return (
    // No `overflow-hidden`: the school dropdown is positioned inside this card,
    // and a clip here cuts the list off at the card's edge — the options below
    // that line are unreachable, and the keyboard cursor scrolls into the part
    // nobody can see. The sunken header rounds its own top corners instead.
    <div className="mt-9 rounded-xl border border-border bg-surface shadow-card">
      <div className="grid rounded-t-xl border-b border-border bg-sunken p-5 sm:grid-cols-2 sm:gap-5 sm:p-7">
        <div>
          <Label htmlFor="school-search" className="flex items-center gap-2 uppercase tracking-[0.12em]">
            <Building2 aria-hidden className="size-4 text-primary" />
            1. Choose a school
          </Label>
          <div className="mt-3">
            <SchoolCombobox
              institutions={institutions}
              filters={NO_FILTERS}
              reviewedKeys={reviewed}
              selected={school}
              onSelect={pickSchool}
            />
          </div>
        </div>

        <div className="mt-5 sm:mt-0">
          <Label htmlFor="course-select" className="flex items-center gap-2 uppercase tracking-[0.12em]">
            <GraduationCap aria-hidden className="size-4 text-primary" />
            2. Choose a course
          </Label>
          {/* Radix reserves the empty string as an item value, so "nothing
              chosen yet" is the root's `''` rendered as the placeholder rather
              than an item of its own. */}
          <Select
            value={courseKey}
            onValueChange={setCourseKey}
            disabled={!school || pending || !courses.length}
          >
            <SelectTrigger id="course-select" className="mt-3 h-12 bg-background">
              <SelectValue
                placeholder={
                  !school
                    ? 'Choose a school first'
                    : pending
                      ? 'Loading courses…'
                      : courses.length
                        ? 'Choose a course'
                        : 'No courses listed'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {courses.map((entry) => (
                <SelectItem
                  key={entry.key}
                  value={entry.key}
                  hint={
                    entry.reviewedCourseId
                      ? 'Reviewed'
                      : entry.ruleStatus === 'ready'
                        ? 'Read'
                        : 'Unverified'
                  }
                >
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pending ? (
        <p className="flex items-center gap-2.5 p-5 text-[0.9375rem] text-muted sm:p-7">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading the courses this school lists&hellip;
        </p>
      ) : course ? (
        <CoursePanel
          course={course}
          school={school}
          checkableId={checkableId}
          reading={reading}
          onCheck={(id) => router.push(`/check?course=${id}`)}
        />
      ) : noDetail ? (
        <p className="p-5 text-[0.9375rem] leading-relaxed text-muted sm:p-7">
          The catalogue holds no course detail for this school yet. That is a gap in what we have
          imported &mdash; it is not a statement that the school offers nothing. Check the
          institution in the JAMB IBASS brochure, or ask the Copilot below.
        </p>
      ) : (
        <p className="p-5 text-[0.9375rem] leading-relaxed text-muted sm:p-7">
          Search for the school you have in mind above, then pick the course you want to check.
        </p>
      )}
    </div>
  )
}

/**
 * What the chosen course can actually do.
 *
 * The branches are deliberately different shapes rather than one panel with a
 * disabled button. A course the checker can decide on leads into it; a course it
 * cannot leads to the official record and says why there is no verdict — which
 * is the whole honesty boundary this app is built around, and the one place a
 * student is most likely to assume we know more than we do.
 *
 * `checkableId` and `reading` are passed in rather than derived here, because
 * they are the parent's answer about this course and a second derivation is a
 * second thing that can disagree.
 */
function CoursePanel({
  course,
  school,
  checkableId,
  reading,
  onCheck,
}: {
  course: SchoolCourse
  school: CatalogueInstitution | null
  /** The id the checker can decide on, or null when it cannot. */
  checkableId: string | null
  /** Whether a rule is being read for this course right now. */
  reading: boolean
  onCheck: (id: string) => void
}) {
  const reviewedCourseId = course.reviewedCourseId

  return (
    <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.8125rem] font-medium uppercase tracking-[0.1em] text-muted">
            {school?.name ?? ''}
            {course.department ? ` · ${course.department}` : ''}
          </p>
          {/* Nothing is claimed while a read is in flight — the answer is
              genuinely not known yet, and a badge would be a guess. */}
          {reading ? null : (
            <Badge tone={reviewedCourseId ? 'success' : checkableId ? 'accent' : 'outline'}>
              {reviewedCourseId
                ? 'Reviewed by our checker'
                : checkableId
                  ? 'Read from IBASS'
                  : 'Unverified listing'}
            </Badge>
          )}
        </div>

        <h2 className="mt-1 text-[1.375rem]">{course.name}</h2>

        {reading ? (
          <p className="mt-2 flex items-center gap-2.5 text-[0.9375rem] text-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Reading this course&rsquo;s requirements from the IBASS brochure&hellip;
          </p>
        ) : reviewedCourseId ? (
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
            We have reviewed this course&rsquo;s requirements, so we can tell you whether your
            O-level results meet them.
          </p>
        ) : checkableId ? (
          // Deliberately not "reviewed". We read the sentence the brochure
          // publishes; no person has checked the reading, and this badge is
          // exactly where a student would take that to mean one had.
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
            We have read this course&rsquo;s entry requirement out of the IBASS brochure, so we can
            tell you whether your O-level results meet it. No one has checked the reading by hand
            &mdash; if the answer looks wrong, tell us and a counselor will look at it.
          </p>
        ) : (
          <>
            <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
              {/* The sentence that offers the subject list only appears when
                  there is a list. It used to promise them and then render
                  nothing, which reads as a broken page rather than as a
                  programme whose combination the catalogue does not hold. */}
              {course.utmeSubjects.length
                ? 'We have not reviewed this course yet, so we cannot tell you whether you qualify. The catalogue lists it, and these are the UTME subjects it carries — confirm the current requirements in IBASS and the school’s own bulletin.'
                : 'We have not reviewed this course yet, so we cannot tell you whether you qualify. The catalogue lists it, but holds no subject combination for it — confirm the current requirements in IBASS and the school’s own bulletin.'}
            </p>

            {course.utmeSubjects.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {course.utmeSubjects.map((label) => (
                  <li
                    key={label}
                    className="rounded-sm bg-sunken px-2 py-1 text-[0.8125rem] text-muted"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>

      {reading ? null : checkableId ? (
        <Button
          type="button"
          size="lg"
          onClick={() => onCheck(checkableId)}
          className="group justify-self-start sm:justify-self-end"
        >
          Check my results
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      ) : (
        <Button asChild variant="ghost" size="lg" className="justify-self-start sm:justify-self-end">
          <a href={course.sourceUrl} target="_blank" rel="noopener noreferrer">
            Check in IBASS
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </Button>
      )}
    </div>
  )
}
