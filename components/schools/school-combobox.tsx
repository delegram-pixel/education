'use client'

import { Check, Search, X } from 'lucide-react'
import * as React from 'react'

import type { CatalogueInstitution } from '@/lib/db/catalogue'
import {
  suggestInstitutions,
  type InstitutionFilters,
  type InstitutionSuggestion,
} from '@/lib/institutions'
import { cn } from '@/lib/utils'

/**
 * School search as a type-ahead combobox.
 *
 * WHY NOT A LIST OF SCHOOLS: the catalogue is national — hundreds of schools,
 * thousands of programmes — and a page that renders them all makes the student
 * scroll before they have said what they are looking for. The dropdown is the
 * list: it opens on the most useful schools, narrows as they type, and hands
 * back exactly one.
 *
 * WHY THE GROUPS: a reviewed school has a course the eligibility checker can
 * return a verdict on; every other school's only next step is to go and read
 * IBASS. That difference decides what the student can do next, so it is a
 * heading rather than a sort order they have to infer.
 *
 * Hand-rolled rather than Radix: the repo has `react-select` and no combobox
 * primitive, and Radix's Select typeahead jumps to an item rather than filtering
 * the list, which is the wrong interaction at this size.
 */

const MAX_SUGGESTIONS = 40

export function SchoolCombobox({
  institutions,
  filters,
  reviewedKeys,
  selected,
  onSelect,
}: {
  institutions: CatalogueInstitution[]
  filters: InstitutionFilters
  reviewedKeys: ReadonlySet<string>
  /** The chosen school, so the input can echo a name the parent may have cleared. */
  selected: CatalogueInstitution | null
  onSelect: (institution: CatalogueInstitution | null) => void
}) {
  const [text, setText] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const baseId = React.useId()

  const suggestions = React.useMemo(
    () =>
      suggestInstitutions(institutions, { ...filters, query: text }, reviewedKeys, MAX_SUGGESTIONS),
    [institutions, filters, text, reviewedKeys],
  )

  // One flat sequence for the keyboard, so the arrow keys cross the group
  // boundary without the handler needing to know the groups exist.
  const options = React.useMemo(
    () => [...suggestions.reviewed, ...suggestions.listings],
    [suggestions],
  )
  const optionCount = options.length

  // A new query is a new list; keeping the old cursor would leave Enter pointing
  // at whatever happened to sit at that index in the previous one.
  React.useEffect(() => {
    setActiveIndex(0)
  }, [text, filters])

  // The parent owns the selection; the input mirrors it. Without this, a
  // selection cleared anywhere else would leave a name in the box that no longer
  // refers to anything. Typing does not re-fire it, because typing does not
  // change the selection.
  //
  // Selecting the whole value once it lands matters because the box keeps focus
  // through a pick — the option's pointerdown is prevented, so the input never
  // blurs — and a programmatic value change leaves the caret at the end. Without
  // this, the next keystroke would append to the name just chosen ("University of
  // Lagosy") instead of starting a new search.
  React.useEffect(() => {
    setText(selected?.name ?? '')
    if (selected) inputRef.current?.select()
  }, [selected])

  React.useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, optionCount])

  React.useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function choose(institution: CatalogueInstitution) {
    // Not dead code alongside the effect below: re-picking the school that is
    // already selected hands the parent the same object, React bails out of the
    // state update, and the effect never runs — so a half-typed query would stay
    // in the box. This restores the full name either way.
    setText(institution.name)
    setOpen(false)
    onSelect(institution)
  }

  function clear() {
    setText('')
    setOpen(false)
    onSelect(null)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!optionCount) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + delta + optionCount) % optionCount)
      return
    }

    if (event.key === 'Enter') {
      const option = options[activeIndex]
      if (open && option) {
        event.preventDefault()
        choose(option.institution)
      }
      return
    }

    if (event.key === 'Escape' || event.key === 'Tab') setOpen(false)
  }

  function renderOption(entry: InstitutionSuggestion, index: number) {
    const active = index === activeIndex

    return (
      <div
        key={entry.institution.id}
        id={`${baseId}-option-${index}`}
        role="option"
        aria-selected={active}
        data-index={index}
        // Pointer, not click: the input would blur first and close the list out
        // from under the click.
        onPointerDown={(event) => {
          event.preventDefault()
          choose(entry.institution)
        }}
        onMouseEnter={() => setActiveIndex(index)}
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 transition-colors duration-150',
          active ? 'bg-accent text-accent-fg' : 'hover:bg-accent-subtle',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium">{entry.institution.name}</span>
          <span className={cn('mt-0.5 block text-[0.8125rem]', active ? 'text-accent-fg/80' : 'text-muted')}>
            {entry.institution.state ?? 'State not recorded'} &middot;{' '}
            {entry.institution.programmeCount} listed
          </span>
        </span>
        {entry.reviewed ? <Check aria-hidden className="size-4 shrink-0" /> : null}
      </div>
    )
  }

  const hidden = suggestions.total - optionCount

  return (
    <div ref={rootRef} className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
      <input
        id="school-search"
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${baseId}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={open && optionCount ? `${baseId}-option-${activeIndex}` : undefined}
        aria-describedby="school-count"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
        }}
        // Selecting all on focus means typing replaces the chosen school rather
        // than appending to its name.
        onFocus={(event) => {
          setOpen(true)
          event.target.select()
        }}
        onKeyDown={onKeyDown}
        placeholder="Search any school in Nigeria…"
        className={cn(
          'w-full rounded-md border border-border bg-surface py-2.5 pl-10 pr-10 text-[1rem]',
          'transition-[border-color,box-shadow] duration-200',
          'placeholder:text-muted/70 hover:border-border-strong',
          'focus:border-primary focus:outline-2 focus:outline-primary focus:ring-2 focus:ring-accent',
        )}
      />

      {text ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear the school search"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted transition-colors hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}

      {open ? (
        <div
          ref={listRef}
          id={`${baseId}-listbox`}
          role="listbox"
          aria-label="Schools"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-md border border-border bg-surface p-1.5 shadow-lifted"
        >
          {optionCount ? (
            <>
              {suggestions.reviewed.length ? (
                <div role="group" aria-labelledby={`${baseId}-reviewed`}>
                  <p
                    id={`${baseId}-reviewed`}
                    className="px-3 pb-1 pt-2 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-muted"
                  >
                    Reviewed by our checker
                  </p>
                  {suggestions.reviewed.map((entry, index) => renderOption(entry, index))}
                </div>
              ) : null}

              {suggestions.listings.length ? (
                <div role="group" aria-labelledby={`${baseId}-listings`}>
                  <p
                    id={`${baseId}-listings`}
                    className="px-3 pb-1 pt-3 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-muted"
                  >
                    Catalogue listings
                  </p>
                  {suggestions.listings.map((entry, index) =>
                    renderOption(entry, suggestions.reviewed.length + index),
                  )}
                </div>
              ) : null}

              {hidden > 0 ? (
                <p className="px-3 py-2 text-[0.8125rem] text-muted" role="presentation">
                  {hidden} more match &mdash; keep typing to narrow.
                </p>
              ) : null}
            </>
          ) : (
            <p className="px-3 py-4 text-center text-[0.9375rem] text-muted">
              No school matches {text.trim() ? `“${text.trim()}”` : 'those filters'}. It may still be
              listed under a different name &mdash; clear the filters, or ask the Copilot below.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
