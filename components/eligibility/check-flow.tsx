'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { OLevelForm } from '@/components/eligibility/olevel-form'
import { VerdictCard } from '@/components/eligibility/verdict-card'
import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import { Button } from '@/components/ui/button'
import { runCheck, type CheckState } from '@/app/check/actions'
import type { Course, OLevelResult } from '@/lib/types'

/**
 * Orchestrates the two halves of a check: the form, then the verdict.
 *
 * The verdict replaces the form in place rather than navigating, so a student
 * who wants to correct a grade does not lose everything they typed. The browser
 * history is left alone for the same reason — Back should leave the check, not
 * unwind it a field at a time.
 */
export function CheckFlow({ course }: { course: Course }) {
  const [state, setState] = React.useState<CheckState>({ status: 'idle' })
  const [pending, startTransition] = React.useTransition()
  const resultRef = React.useRef<HTMLDivElement>(null)

  function submit(results: OLevelResult[]) {
    startTransition(async () => {
      const next = await runCheck(course.id, results)
      setState(next)

      if (next.status === 'done') {
        // Move focus as well as scroll: a keyboard or screen-reader user must
        // land on the answer, not be left at the bottom of a form that vanished.
        requestAnimationFrame(() => {
          resultRef.current?.focus({ preventScroll: true })
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    })
  }

  if (state.status === 'done') {
    return (
      <div ref={resultRef} tabIndex={-1} className="outline-none">
        <VerdictCard verdict={state.verdict} course={course} shareId={state.shareId} />

        <div className="mt-8 border-t border-border pt-6">
          <Button variant="ghost" onClick={() => setState({ status: 'idle' })}>
            <ArrowLeft aria-hidden className="size-4" />
            Change my results
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/check">
            <ArrowLeft aria-hidden className="size-4" />
            Choose a different course
          </Link>
        </Button>

        {/* Friction point: typing nine subjects. The widget accepts a photo. */}
        <AskCopilotButton
          suggestedQuestion={`I have my O'level result slip as a photo. Can I upload it so you can read my grades for ${course.name}?`}
          label="Upload my result slip instead"
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-6 shadow-card sm:p-8">
        <OLevelForm course={course} pending={pending} onSubmit={submit} />
      </div>

      {state.status === 'error' ? (
        <p className="mt-4 rounded-md border border-danger/25 bg-danger-subtle px-4 py-3 text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </>
  )
}
