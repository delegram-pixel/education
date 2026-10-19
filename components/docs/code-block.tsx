'use client'

import { Check, Copy } from 'lucide-react'
import * as React from 'react'

import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

/**
 * A code sample with a copy button, for the API reference.
 *
 * The block keeps the dark charcoal ground from the design system in both
 * themes: `--color-primary-dark` is not redefined for dark mode, so the sample
 * stays a stable dark panel against either page. That is deliberate — a code
 * block that inverts with the theme reads as part of the prose, and the panel
 * is there to say "this is literal, copy it".
 *
 * Long lines scroll inside the block rather than widening the page. A request
 * URL with a cursor in it is longer than a phone.
 */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string
  /** Shown in the title bar. Defaults to "example". */
  label?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | null>(null)
  const toast = useToast()

  React.useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast('Copied to clipboard', 'success')
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access is denied on insecure origins and in some browsers.
      // The code is selectable either way, so say that instead of failing mute.
      toast('Could not copy — select the text instead', 'danger')
    }
  }

  return (
    <div
      className={cn(
        'mt-4 overflow-hidden rounded-md border border-[var(--color-light-gray)]',
        'bg-[var(--color-primary-dark)] text-[var(--color-accent-light)] shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 font-mono text-xs text-white/70">
        <span className="truncate">{label ?? 'example'}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 py-1 transition-colors duration-200 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}
