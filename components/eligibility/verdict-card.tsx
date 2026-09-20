'use client'

import { AlertCircle, Check, CheckCircle2, Copy, Info, X } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import { AdmissionSafetyNotice } from '@/components/shared/admission-safety-notice'
import { Badge } from '@/components/ui/badge'
import { Arrow, Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { LANGUAGES, useLanguage } from '@/components/shared/language-preference'
import { subjectName, type Course, type Verdict } from '@/lib/types'
import { cn } from '@/lib/utils'

const TONE = {
  eligible: {
    icon: CheckCircle2,
    label: 'You qualify',
    ring: 'border-success/30',
    wash: 'bg-success-subtle',
    text: 'text-success',
    stroke: 'stroke-[var(--success)]',
  },
  partial: {
    icon: AlertCircle,
    // Never "partially eligible". A student reads that as a no.
    label: 'Almost there',
    ring: 'border-warning/30',
    wash: 'bg-warning-subtle',
    text: 'text-warning',
    stroke: 'stroke-[var(--warning)]',
  },
  not_eligible: {
    icon: Info,
    // Never "not eligible". "Not yet" is true, and it is the difference
    // between a student re-sitting one paper and giving up entirely.
    label: 'Not yet',
    ring: 'border-danger/30',
    wash: 'bg-danger-subtle',
    text: 'text-danger',
    stroke: 'stroke-[var(--danger)]',
  },
} as const

/** A ring that draws itself to the proportion of credits earned. */
function CreditRing({ have, need, stroke }: { have: number; need: number; stroke: string }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const ratio = Math.min(1, have / Math.max(need, 1))
  const [drawn, setDrawn] = React.useState(false)

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="relative grid size-[4.5rem] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" className="stroke-border" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          className={cn(stroke, 'transition-[stroke-dashoffset] duration-[900ms] ease-[var(--ease-out-quint)]')}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={drawn ? circumference * (1 - ratio) : circumference}
        />
      </svg>
      <span className="tabular absolute text-[1.125rem] font-semibold">
        {have}
        <span className="text-[0.8125rem] font-normal text-muted">/{need}</span>
      </span>
    </div>
  )
}

export function VerdictCard({
  verdict,
  course,
  shareId,
}: {
  verdict: Verdict
  course: Course
  shareId: string | null
}) {
  const tone = TONE[verdict.status]
  const Icon = tone.icon
  const toast = useToast()
  const { language } = useLanguage()
  const escalationContext = [
    'I need a counselor to review an eligibility result.',
    `Course: ${course.name} at ${course.institution}.`,
    `Checker verdict: ${verdict.explanation}`,
    `Credits counted: ${verdict.creditCount}/${course.olevelRule.minCredits}.`,
    verdict.missing.length
      ? `Requirements to review: ${verdict.missing.map((item) => subjectName(item.subject)).join(', ')}.`
      : null,
    `Preferred response language: ${LANGUAGES[language].label}.`,
  ]
    .filter(Boolean)
    .join('\n')

  const requirements = [
    ...verdict.satisfied.map((s) => ({
      key: s.subject,
      label: subjectName(s.subject),
      detail: `Grade ${s.grade}`,
      met: true,
    })),
    ...verdict.missing.map((m) => ({
      key: m.subject,
      label: subjectName(m.subject),
      detail: m.reason === 'below_credit' ? `You have ${m.grade} — not a credit` : 'Not entered',
      met: false,
    })),
  ]

  async function share() {
    if (!shareId) return
    const url = `${window.location.origin}/r/${shareId}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied — send it to whoever is helping you.', 'success')
    } catch {
      toast('Copy failed. The link is in your address bar after you open it.')
    }
  }

  return (
    <div className="animate-settle">
      {/* Headline verdict. The sentence leads; the status label is secondary. */}
      <div className={cn('rounded-xl border p-6 sm:p-8', tone.ring, tone.wash)}>
        <div className="flex flex-wrap items-start gap-5">
          <CreditRing
            have={verdict.creditCount}
            need={course.olevelRule.minCredits}
            stroke={tone.stroke}
          />

          <div className="min-w-0 flex-1">
            <span className={cn('inline-flex items-center gap-1.5 text-[0.875rem] font-medium', tone.text)}>
              <Icon aria-hidden className="size-4" />
              {tone.label}
            </span>
            <p
              className="mt-2 font-display text-[1.375rem] leading-snug sm:text-[1.625rem]"
              role="status"
              aria-live="polite"
            >
              {verdict.explanation}
            </p>
            <p className="mt-2.5 text-[0.9375rem] text-muted">
              {course.name} &middot; {course.institution}
              {verdict.sittingsUsed > 1 ? ' · counted across two sittings' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Requirement checklist. Rows stamp in one after another rather than
          appearing at once — the sequence is what makes it read as a check
          being performed rather than a result being asserted. */}
      <div className="mt-5 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h3 className="text-[1.0625rem]">What this course asks for</h3>

        <ul className="mt-4 divide-y divide-border">
          {requirements.map((req, i) => (
            <li key={req.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    'animate-stamp grid size-6 shrink-0 place-items-center rounded-full',
                    req.met ? 'bg-success text-white' : 'bg-warning/15 text-warning',
                  )}
                  style={{ animationDelay: `${140 + i * 90}ms` }}
                >
                  {req.met ? (
                    <Check aria-hidden className="size-3.5" strokeWidth={3} />
                  ) : (
                    <X aria-hidden className="size-3.5" strokeWidth={3} />
                  )}
                </span>
                <span className="truncate">{req.label}</span>
              </span>
              <span
                className={cn(
                  'shrink-0 text-[0.875rem]',
                  req.met ? 'text-muted' : 'font-medium text-warning',
                )}
              >
                {req.detail}
              </span>
            </li>
          ))}
        </ul>

        {verdict.unmetGroups.map((group) => (
          <div
            key={group.label}
            className="mt-4 rounded-md border border-warning/25 bg-warning-subtle px-4 py-3 text-[0.9375rem] text-warning"
          >
            You have {group.have} of the {group.need} credits needed from {group.label}.
          </div>
        ))}
      </div>

      {/* What to do next. Always present, including when the answer is no. */}
      <div className="mt-5 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h3 className="text-[1.0625rem]">
          {verdict.status === 'eligible' ? 'What happens next' : 'How to close the gap'}
        </h3>
        <ol className="mt-4 space-y-3">
          {verdict.nextSteps.map((step, i) => (
            <li
              key={step}
              className="animate-settle flex gap-3.5 text-[0.9375rem] leading-relaxed"
              style={{ animationDelay: `${240 + i * 70}ms` }}
            >
              <span className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-subtle text-[0.8125rem] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-muted">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* The moment a student is most likely to act on a fee or a deadline is
          the moment they have just been told they qualify. */}
      <AdmissionSafetyNotice compact className="mt-5" />

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {verdict.status === 'eligible' ? (
          <Button asChild size="lg" className="group">
            <Link href="/guide/jamb">
              Walk me through JAMB registration
              <Arrow />
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="group">
            <Link href="/quiz">
              See if this course suits you anyway
              <Arrow />
            </Link>
          </Button>
        )}

        <AskCopilotButton
          size="lg"
          suggestedQuestion={`I checked my O'level results against ${course.name} at ${course.institutionShort} and the result said: "${verdict.explanation}" Can you explain what I should do next?`}
          label="Ask why"
        />

        {shareId ? (
          <Button variant="ghost" size="lg" onClick={share}>
            <Copy aria-hidden className="size-4" />
            Copy link to this result
          </Button>
        ) : null}
      </div>

      {/* The escape hatch. A wrong answer must always be reportable. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-sunken px-5 py-4">
        <p className="text-[0.9375rem] text-muted">
          Does this not match what you were told? A counselor can look at your actual result slip.
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link
            href={`/tickets/new?category=eligibility_dispute&course=${course.id}&lang=${language}&q=${encodeURIComponent(escalationContext)}`}
          >
            This doesn&rsquo;t look right
          </Link>
        </Button>
      </div>

      <p className="mt-5 text-center text-[0.8125rem] text-muted">
        <Badge tone="outline" className="mr-2">
          Sample data
        </Badge>
        Requirements and the {course.utmeCutoff} cut-off shown here are indicative prior-year
        figures for a demonstration, not this year&rsquo;s official numbers.
      </p>
    </div>
  )
}
