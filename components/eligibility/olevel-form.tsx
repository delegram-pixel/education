'use client'

import { Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import { AnimatedNumber } from '@/components/shared/animated-number'
import { Badge } from '@/components/ui/badge'
import { Arrow, Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import {
  ALWAYS_REQUIRED,
  GRADES,
  GRADE_MEANING,
  MAX_SUBJECT_ROWS,
  SUBJECT_CODES,
  isCredit,
  subjectName,
  type Course,
  type Grade,
  type OLevelResult,
  type SubjectCode,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type Row = {
  key: string
  subject: SubjectCode | null
  grade: Grade | null
  sitting: 1 | 2
  /** English and Mathematics cannot be removed — every course requires them. */
  locked: boolean
}

let rowCounter = 0
const newKey = () => `row-${rowCounter++}`

function initialRows(course: Course): Row[] {
  // Pre-fill the subjects this course actually requires, so the student only
  // has to supply grades. Typing nine subject names is the highest-friction
  // moment in the whole flow and most of it is avoidable.
  const required = [
    ...ALWAYS_REQUIRED,
    ...course.olevelRule.mandatory.filter((s) => !ALWAYS_REQUIRED.includes(s)),
  ]

  const rows: Row[] = required.map((subject) => ({
    key: newKey(),
    subject,
    grade: null,
    sitting: 1,
    locked: ALWAYS_REQUIRED.includes(subject),
  }))

  // Top up to five, the usual minimum, so the shape of the task is obvious.
  while (rows.length < 5) {
    rows.push({ key: newKey(), subject: null, grade: null, sitting: 1, locked: false })
  }

  return rows
}

export function OLevelForm({
  course,
  pending,
  onSubmit,
}: {
  course: Course
  pending: boolean
  onSubmit: (results: OLevelResult[]) => void
}) {
  const [rows, setRows] = React.useState<Row[]>(() => initialRows(course))
  const [twoSittings, setTwoSittings] = React.useState(false)
  const [touched, setTouched] = React.useState(false)

  const complete = rows.filter(
    (r): r is Row & { subject: SubjectCode; grade: Grade } => r.subject !== null && r.grade !== null,
  )

  const credits = complete.filter((r) => isCredit(r.grade)).length
  const incompleteCount = rows.length - complete.length
  const canSubmit = complete.length >= 5 && incompleteCount === 0

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    if (rows.length >= MAX_SUBJECT_ROWS) return
    setRows((current) => [
      ...current,
      { key: newKey(), subject: null, grade: null, sitting: 1, locked: false },
    ])
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((r) => r.key !== key))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!canSubmit) return
    onSubmit(
      complete.map(({ subject, grade, sitting }) => ({ subject, grade, sitting })),
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-[1.375rem]">Your O&rsquo;level results</h2>
          <p className="mt-1 text-[0.9375rem] text-muted">
            Enter the grade for each subject exactly as it appears on your result slip.
          </p>
        </div>

        {/* Live tally. It moves as they type, so the target is never abstract. */}
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-md border px-3.5 py-2 transition-colors duration-500',
            credits >= course.olevelRule.minCredits
              ? 'border-success/30 bg-success-subtle text-success'
              : 'border-border bg-sunken text-muted',
          )}
        >
          <span className="text-[1.375rem] font-semibold leading-none">
            <AnimatedNumber value={credits} />
          </span>
          <span className="text-[0.8125rem] leading-tight">
            credit{credits === 1 ? '' : 's'}
            <br />
            of {course.olevelRule.minCredits} needed
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {rows.map((row, index) => {
          const usedElsewhere = new Set(
            rows
              .filter((r) => r.key !== row.key && r.sitting === row.sitting)
              .map((r) => r.subject),
          )
          const missing = touched && (!row.subject || !row.grade)

          return (
            <div
              key={row.key}
              className={cn(
                'grid grid-cols-[1fr_auto] items-center gap-2.5 rounded-md border p-2.5',
                'animate-settle transition-colors duration-200',
                twoSittings ? 'sm:grid-cols-[1fr_7rem_5.5rem_auto]' : 'sm:grid-cols-[1fr_7rem_auto]',
                missing ? 'border-warning/40 bg-warning-subtle/40' : 'border-border bg-surface',
              )}
              style={{ animationDelay: `${index * 35}ms` }}
            >
              {/* Subject */}
              <div className="col-span-2 sm:col-span-1">
                <Label className="sr-only" htmlFor={`${row.key}-subject`}>
                  Subject {index + 1}
                </Label>
                {row.locked ? (
                  <div className="flex h-11 items-center gap-2 rounded-md bg-sunken px-3.5 text-[1.0625rem]">
                    <Lock aria-hidden className="size-3.5 shrink-0 text-muted" />
                    <span className="truncate">{subjectName(row.subject as SubjectCode)}</span>
                  </div>
                ) : (
                  <Select
                    value={row.subject ?? undefined}
                    onValueChange={(value) => update(row.key, { subject: value as SubjectCode })}
                  >
                    <SelectTrigger id={`${row.key}-subject`}>
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECT_CODES.map((code) => (
                        <SelectItem key={code} value={code} disabled={usedElsewhere.has(code)}>
                          {subjectName(code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Grade */}
              <div>
                <Label className="sr-only" htmlFor={`${row.key}-grade`}>
                  Grade for {row.subject ? subjectName(row.subject) : `subject ${index + 1}`}
                </Label>
                <Select
                  value={row.grade ?? undefined}
                  onValueChange={(value) => update(row.key, { grade: value as Grade })}
                >
                  <SelectTrigger id={`${row.key}-grade`} className="tabular">
                    <SelectValue placeholder="Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* The hint is the teaching moment: a student picking D7
                        learns it is not a credit at the instant they pick it. */}
                    {GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade} hint={isCredit(grade) ? 'Credit' : 'Not a credit'}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sitting */}
              {twoSittings ? (
                <div className="flex rounded-md border border-border-strong p-0.5">
                  {([1, 2] as const).map((sitting) => (
                    <button
                      key={sitting}
                      type="button"
                      onClick={() => update(row.key, { sitting })}
                      aria-pressed={row.sitting === sitting}
                      className={cn(
                        'flex-1 rounded-[0.4rem] py-1.5 text-[0.8125rem] transition-colors duration-200',
                        row.sitting === sitting
                          ? 'bg-primary-subtle font-medium text-primary'
                          : 'text-muted hover:text-foreground',
                      )}
                    >
                      {sitting === 1 ? '1st' : '2nd'}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Remove */}
              <div className="flex justify-end">
                {row.locked ? (
                  <span className="grid size-9 place-items-center text-muted/40" aria-hidden>
                    <Lock className="size-4" />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`Remove ${row.subject ? subjectName(row.subject) : `subject ${index + 1}`}`}
                    className="grid size-9 place-items-center rounded-md text-muted transition-colors duration-200 hover:bg-danger-subtle hover:text-danger"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                )}
              </div>

              {row.grade ? (
                <p className="col-span-2 -mt-0.5 px-1 text-[0.75rem] text-muted sm:col-span-full">
                  {GRADE_MEANING[row.grade]}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Tooltip content="Add a subject if your result slip has more papers to enter.">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addRow}
            disabled={rows.length >= MAX_SUBJECT_ROWS}
          >
            <Plus aria-hidden className="size-4" />
            Add another subject
          </Button>
        </Tooltip>

        <label className="flex cursor-pointer items-center gap-2.5 text-[0.9375rem] text-muted">
          <input
            type="checkbox"
            checked={twoSittings}
            onChange={(e) => setTwoSittings(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          I sat for my results twice
        </label>
      </div>

      {twoSittings ? (
        <p className="mt-2 rounded-md bg-primary-subtle px-3.5 py-2.5 text-[0.875rem] text-primary">
          Your best grade in each subject is the one that counts, so a re-sit never costs you
          anything you already passed.
        </p>
      ) : null}

      {touched && !canSubmit ? (
        <p className="mt-4 text-[0.9375rem] text-warning" role="alert">
          {incompleteCount > 0
            ? `Fill in the ${incompleteCount} row${incompleteCount === 1 ? '' : 's'} still missing a subject or grade.`
            : 'Enter at least five subjects — most courses need five credits.'}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <Button type="submit" size="lg" disabled={pending} className="group">
          {pending ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin text-[var(--color-accent-light)]" />
              Checking
            </>
          ) : (
            <>
              Check my eligibility
              <Arrow />
            </>
          )}
        </Button>
        <Badge tone="outline">Nothing here is sent to JAMB or {course.institutionShort}</Badge>
      </div>
    </form>
  )
}
