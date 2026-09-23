'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  DEFAULT_UNIVERSITY,
  filterUniversities,
  getStoredUniversity,
  getUniversityById,
  NIGERIAN_UNIVERSITIES,
  type University,
  UNIVERSITY_STORAGE_KEY,
} from '@/lib/universities'

export function useUniversitySelection() {
  const [selected, setSelected] = React.useState<University>(DEFAULT_UNIVERSITY)

  React.useEffect(() => {
    setSelected(getStoredUniversity())
  }, [])

  const select = React.useCallback((university: University) => {
    setSelected(university)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(UNIVERSITY_STORAGE_KEY, university.id)
      } catch {
        // Ignore storage failures so the feature degrades gracefully.
      }
    }
  }, [])

  return { selected, select }
}

export function UniversityPicker({ className }: { className?: string }) {
  const { selected, select } = useUniversitySelection()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(UNIVERSITY_STORAGE_KEY)
    if (!saved || !getUniversityById(saved)) {
      setOpen(true)
    }
  }, [])

  const matches = React.useMemo(() => filterUniversities(query), [query])

  return (
    <>
      <Tooltip content="Change the university used for this eligibility check.">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn('min-h-11 justify-between gap-3', className)}
        >
          <span className="truncate text-left">{selected.name}</span>
          <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-primary">
            {selected.code}
          </span>
        </Button>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0">
          <div className="p-6 pb-4">
            <DialogTitle className="text-[1.5rem]">Choose your university</DialogTitle>
            <DialogDescription className="mt-2 text-[0.9375rem] text-muted">
              Pick the school you are applying to. Your selection is saved on this device.
            </DialogDescription>
          </div>

          <div className="border-b border-border px-6 pb-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search universities by name, code, or state"
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-[0.9375rem] outline-none ring-0 transition-colors placeholder:text-muted focus:border-primary"
              aria-label="Search universities"
            />
          </div>

          <div className="max-h-[28rem] space-y-1 overflow-y-auto p-4 pt-2">
            {matches.length ? (
              matches.map((university) => {
                const active = university.id === selected.id
                return (
                  <button
                    key={university.id}
                    type="button"
                    onClick={() => {
                      select(university)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary-subtle text-primary'
                        : 'border-transparent bg-sunken hover:border-border hover:bg-surface',
                    )}
                  >
                    <div>
                      <div className="text-[0.95rem] font-medium">{university.name}</div>
                      <div className="mt-1 text-[0.75rem] text-muted">
                        {university.state} &middot; Est. {university.established}
                      </div>
                    </div>
                    <span className="rounded-md border border-border bg-background px-2 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted">
                      {university.code}
                    </span>
                  </button>
                )
              })
            ) : (
              <p className="rounded-md border border-dashed border-border bg-sunken px-4 py-6 text-center text-[0.9375rem] text-muted">
                No universities match that search.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <span className="text-[0.8125rem] text-muted">{NIGERIAN_UNIVERSITIES.length} universities available</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
