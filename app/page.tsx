import { ArrowUpRight, Clock, FileCheck2, LifeBuoy, Route } from 'lucide-react'
import Link from 'next/link'

import { ResultSlip } from '@/components/home/result-slip'
import { Reveal } from '@/components/shared/reveal'
import { Badge } from '@/components/ui/badge'
import { Arrow, Button } from '@/components/ui/button'
import { listCourses } from '@/lib/db/queries'

const STEPS = [
  {
    icon: FileCheck2,
    title: 'Check what you qualify for',
    body: "Enter your O'level subjects and grades once. We compare them against the course you want and tell you plainly where you stand.",
  },
  {
    icon: Route,
    title: 'Get walked through registration',
    body: 'Annotated, step-by-step guides for JAMB registration and POST-UTME screening, with the parts people usually get stuck on called out.',
  },
  {
    icon: LifeBuoy,
    title: 'Reach a person when you need one',
    body: "Ask anything at any point. When a question is genuinely complicated, it becomes a ticket with an ID you can quote, and a counselor picks it up.",
  },
]

export default async function HomePage() {
  const { data: courses } = await listCourses()

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="stagger">
            <div style={{ '--i': 0 } as React.CSSProperties}>
              <Badge tone="accent" className="mb-5">
                <Clock aria-hidden className="size-3.5" />
                Most people finish in under two minutes
              </Badge>
            </div>

            <h1
              className="text-[2.5rem] leading-[1.08] sm:text-[3.25rem] lg:text-[3.75rem]"
              style={{ '--i': 1 } as React.CSSProperties}
            >
              Find out if you qualify,
              <br />
              <span className="relative inline-block">
                before it&rsquo;s too late.
                {/* A drawn underline rather than a highlight block. */}
                <svg
                  aria-hidden
                  viewBox="0 0 320 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1 left-0 h-2.5 w-full text-accent"
                >
                  <path
                    d="M2 8.5C58 3.5 132 2 200 4.5c40 1.5 80 3 118 2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p
              className="mt-7 max-w-xl text-[1.125rem] leading-relaxed text-muted"
              style={{ '--i': 2 } as React.CSSProperties}
            >
              Thousands of students who could have got in miss out every year — not because
              they weren&rsquo;t good enough, but because nobody explained the process in time.
              This checks your results against a course and walks you through the rest.
            </p>

            <div
              className="mt-8 flex flex-col gap-3 sm:flex-row"
              style={{ '--i': 3 } as React.CSSProperties}
            >
              <Button asChild size="lg" className="group">
                <Link href="/check">
                  Check my eligibility
                  <Arrow />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/guide">See the registration guides</Link>
              </Button>
            </div>

            <p
              className="mt-5 text-[0.875rem] text-muted"
              style={{ '--i': 4 } as React.CSSProperties}
            >
              No sign-up, no fee, nothing to download.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <ResultSlip />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The admissions path                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal className="grid gap-5 border-b border-border pb-8 md:grid-cols-[0.72fr_1fr] md:items-end">
          <div>
            <span className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-primary">
              Your admissions path
            </span>
            <h2 className="mt-3 text-[1.875rem] sm:text-[2.25rem]">Start where you are.</h2>
          </div>
          <p className="max-w-xl text-[1rem] leading-relaxed text-muted md:justify-self-end">
            One clear next step at a time — check your subjects first, then use the guide or ask
            for help only if you need it.
          </p>
        </Reveal>

        <ol className="divide-y divide-border">
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 90}>
              <div className="grid gap-4 py-7 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center sm:gap-6 sm:py-8">
                <div className="flex items-center gap-3 sm:block">
                  <span className="font-display text-[2rem] leading-none text-primary sm:text-[2.5rem]">
                    0{i + 1}
                  </span>
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary-subtle text-primary sm:mt-3">
                    <step.icon aria-hidden className="size-4" />
                  </span>
                </div>
                <div className="max-w-2xl">
                  <h3 className="text-[1.1875rem]">{step.title}</h3>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">{step.body}</p>
                </div>
                {i === 0 ? (
                  <Button asChild variant="secondary" size="sm" className="justify-self-start sm:justify-self-end">
                    <Link href="/check">
                      Start now
                      <Arrow />
                    </Link>
                  </Button>
                ) : (
                  <span className="hidden text-[0.8125rem] font-medium text-muted sm:block">When you need it</span>
                )}
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Courses                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[1.875rem] sm:text-[2.25rem]">Start with a course</h2>
            <p className="mt-3 max-w-2xl text-muted">
              Three courses at the University of Lagos, as a worked example.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="group">
            <Link href="/check">
              All courses
              <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </Reveal>

        <ul className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {courses.map((course, i) => (
            <Reveal
              as="li"
              key={course.id}
              delay={i * 90}
              className="border-b border-border last:border-b-0"
            >
              <Link
                href={`/check?course=${course.id}`}
                className="group grid gap-3 p-5 transition-colors duration-200 hover:bg-primary-subtle/45 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center sm:gap-6 sm:p-6"
              >
                <div className="flex items-center gap-3 sm:block">
                  <span className="font-display text-[1.75rem] leading-none text-primary sm:text-[2.25rem]">
                    0{i + 1}
                  </span>
                  <span className="mt-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
                    {course.institutionShort}
                  </span>
                </div>
                <div>
                  <h3
                    className="text-[1.25rem] transition-colors group-hover:text-primary"
                    // Morphs into the heading of the page it opens, where the
                    // browser supports it. Purely additive.
                    style={{ viewTransitionName: `course-${course.id}` }}
                  >
                    {course.name}
                  </h3>
                  <p className="mt-1.5 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
                    {course.blurb}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-5 border-t border-border pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
                  <span className="block text-[0.8125rem] text-muted">{course.durationYears} years</span>
                  <span className="mt-1.5 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-primary">
                    Check results
                    <Arrow className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Honesty panel — what this is, and what it is not                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="overflow-hidden rounded-xl border border-border bg-sunken">
            <div className="grid gap-8 p-8 sm:p-10 md:grid-cols-2">
              <div>
                <h2 className="text-[1.5rem]">What this can tell you</h2>
                <ul className="mt-4 space-y-2.5 text-[0.9375rem] leading-relaxed text-muted">
                  <li>Whether your grades meet a course&rsquo;s stated requirements.</li>
                  <li>Exactly which subject is holding you back, and what fixes it.</li>
                  <li>What each screen of the registration process is asking you for.</li>
                  <li>Whether a course is likely to suit how you actually like to work.</li>
                </ul>
              </div>
              <div>
                <h2 className="text-[1.5rem]">What it can&rsquo;t</h2>
                <ul className="mt-4 space-y-2.5 text-[0.9375rem] leading-relaxed text-muted">
                  <li>Guarantee admission — meeting the requirements is the start, not the end.</li>
                  <li>
                    Replace the official brochure. The requirements here are{' '}
                    <strong className="font-medium text-foreground">reference data</strong> to help
                    you understand the check, not a substitute for the official bulletin.
                  </li>
                  <li>See your actual JAMB or institution account. Nothing here is connected to them.</li>
                  <li>Settle a dispute about your result. That needs a person, and we&rsquo;ll get you one.</li>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
