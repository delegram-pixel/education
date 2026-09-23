'use client'

import { CheckCircle2, ClipboardPaste } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GRADES,
  SUBJECTS,
  type Grade,
  type OLevelResult,
  type SubjectCode,
} from '@/lib/types'

const SUBJECT_ALIASES: Record<string, SubjectCode> = {
  ENGLISH: 'ENG',
  'ENGLISH LANGUAGE': 'ENG',
  MATHEMATICS: 'MTH',
  MATHS: 'MTH',
  MATH: 'MTH',
  BIOLOGY: 'BIO',
  CHEMISTRY: 'CHM',
  PHYSICS: 'PHY',
  ECONOMICS: 'ECO',
  GOVERNMENT: 'GOV',
  COMMERCE: 'CMM',
  ACCOUNTING: 'ACC',
  'FINANCIAL ACCOUNTING': 'ACC',
  GEOGRAPHY: 'GEO',
  LITERATURE: 'LIT',
  'LITERATURE IN ENGLISH': 'LIT',
  HISTORY: 'HIS',
  'AGRICULTURAL SCIENCE': 'AGR',
  'FURTHER MATHEMATICS': 'FMA',
  'CIVIC EDUCATION': 'CVE',
}

function parseTranscript(value: string): OLevelResult[] {
  const parsed = new Map<SubjectCode, Grade>()

  for (const line of value.split('\n')) {
    const grade = line.toUpperCase().match(/\b(A1|B2|B3|C4|C5|C6|D7|E8|F9)\b/)?.[1] as Grade | undefined
    if (!grade || !GRADES.includes(grade)) continue

    const normalized = line
      .toUpperCase()
      .replace(/\b(A1|B2|B3|C4|C5|C6|D7|E8|F9)\b/g, '')
      .replace(/[^A-Z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const subject = SUBJECT_ALIASES[normalized] ??
      (Object.keys(SUBJECTS) as SubjectCode[]).find((code) => SUBJECTS[code].toUpperCase() === normalized)
    if (subject) parsed.set(subject, grade)
  }

  return [...parsed].map(([subject, grade]) => ({ subject, grade, sitting: 1 }))
}

export function ResultSlipImport({ onApply }: { onApply: (results: OLevelResult[]) => void }) {
  const [text, setText] = React.useState('')
  const results = React.useMemo(() => parseTranscript(text), [text])

  return (
    <details className="mb-6 rounded-lg border border-border bg-sunken p-4">
      <summary className="cursor-pointer list-none font-medium marker:content-['']">
        <span className="flex items-center gap-2">
          <ClipboardPaste aria-hidden className="size-4 text-primary" />
          Fill from a copied result-slip transcript
          <Badge tone="outline" className="ml-auto">Review first</Badge>
        </span>
      </summary>
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-[0.875rem] leading-relaxed text-muted">
          Paste one subject and grade per line, for example “English Language C4”. We recognise
          the common subjects, show what was found, and only fill the form after you confirm it.
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          placeholder={'English Language C4\nMathematics B3\nBiology C5'}
          className="mt-3 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[0.9375rem] outline-none transition-colors focus:border-primary"
        />
        {text ? (
          <div className="mt-3 rounded-md bg-surface p-3">
            <p className="text-[0.8125rem] font-medium text-muted">Found {results.length} subject{results.length === 1 ? '' : 's'}</p>
            {results.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {results.map((result) => (
                  <li key={result.subject} className="rounded bg-primary-subtle px-2 py-1 text-[0.8125rem] text-primary">
                    {SUBJECTS[result.subject]} · {result.grade}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[0.8125rem] text-warning">No recognised subject-and-grade pairs yet.</p>
            )}
          </div>
        ) : null}
        <Button type="button" size="sm" className="mt-3" disabled={results.length === 0} onClick={() => onApply(results)}>
          <CheckCircle2 aria-hidden className="size-4" />
          Review these in the form
        </Button>
        <p className="mt-3 text-[0.75rem] text-muted">This does not upload your slip or send it to JAMB.</p>
      </div>
    </details>
  )
}
