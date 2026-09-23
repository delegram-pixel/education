'use client'

import { CircleHelp } from 'lucide-react'

import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import type { Walkthrough, WalkthroughStep } from '@/lib/types'

/**
 * The two questions a student actually has mid-registration, asked on the
 * student's behalf with the current step attached.
 *
 * The context is the point. Swift has no idea which screen the student is
 * looking at, so "what does this field mean?" on its own gets a generic answer
 * about JAMB. Sent with the step title, its instruction, and the terms the step
 * defines, it gets an answer about *this* screen — which is the whole reason to
 * put a trigger here rather than leaving the student to describe their position
 * from scratch.
 *
 * Rendered once per step and never inside the step's keyed panel, so moving
 * between steps does not restart the widget polling behind every button.
 */
export function StepCompanion({
  walkthrough,
  step,
}: {
  walkthrough: Walkthrough
  step: WalkthroughStep
}) {
  const glossary = step.defines?.length
    ? `The step explains these terms: ${step.defines
        .map((entry) => `${entry.term} — ${entry.meaning}`)
        .join(' ')}`
    : null

  const meaningQuestion = [
    `I am on step ${step.order} of "${walkthrough.title}": ${step.title}.`,
    `The step says: ${step.instruction}`,
    glossary,
    'In plain language, what does this screen or field mean, and what exactly am I being asked to enter or do here?',
  ]
    .filter(Boolean)
    .join('\n')

  const readyQuestion = [
    `I am about to continue past step ${step.order} of "${walkthrough.title}": ${step.title}.`,
    `The step says: ${step.instruction}`,
    `The guide says to have these ready for the whole process: ${walkthrough.bringWithYou.join('; ')}.`,
    step.tip ? `The guide flags this as the usual sticking point: ${step.tip}` : null,
    'What should I have ready before I continue, and what should I check on this screen before I move on?',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-4 shadow-card">
      <p className="flex items-center gap-2.5 text-[0.9375rem] font-medium">
        <CircleHelp aria-hidden className="size-5 shrink-0 text-primary" />
        Questions about this step?
      </p>

      <div className="mt-3 flex flex-wrap gap-2.5">
        <AskCopilotButton
          suggestedQuestion={meaningQuestion}
          label="What does this field mean?"
          showIcon={false}
          className="text-left"
        />
        <AskCopilotButton
          suggestedQuestion={readyQuestion}
          label="What do I need before I continue?"
          showIcon={false}
          className="text-left"
        />
      </div>

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
        Screen not looking like this, or something not working? Ask either question and say what you
        actually see — the question goes with this step&rsquo;s details attached.
      </p>
    </div>
  )
}
