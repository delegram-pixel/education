'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A minimal toast stack.
 *
 * Positioned bottom-LEFT, which is not the conventional corner. That is
 * deliberate: the Swift Agents launcher occupies the bottom-right of every page
 * in this app, and a toast that covered the support launcher would hide the one
 * control a stuck student most needs.
 *
 * Enter and exit are plain CSS transitions rather than an animation library.
 * This provider sits in the root layout, so anything it imports lands in the
 * bundle of every single route — an animation library here cost ~40 kB on
 * pages that never show a toast at all. Two class names do the same job.
 */

type Toast = {
  id: number
  message: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
  leaving: boolean
}
type ToastContextValue = (
  message: string,
  tone?: 'neutral' | 'success' | 'warning' | 'danger',
) => void

const ToastContext = React.createContext<ToastContextValue | null>(null)

const VISIBLE_MS = 4200
const EXIT_MS = 260

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const nextId = React.useRef(0)
  const timers = React.useRef<number[]>([])

  React.useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(window.clearTimeout)
  }, [])

  const push = React.useCallback<ToastContextValue>((message, tone = 'neutral') => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message, tone, leaving: false }])

    timers.current.push(
      window.setTimeout(() => {
        setToasts((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
        timers.current.push(
          window.setTimeout(
            () => setToasts((current) => current.filter((t) => t.id !== id)),
            EXIT_MS,
          ),
        )
      }, VISIBLE_MS),
    )
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 left-5 z-[60] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto rounded-md border px-4 py-3 text-[0.9375rem] font-medium shadow-lifted',
              'transition-[opacity,transform] duration-[260ms] ease-[var(--ease-out-quint)]',
              toast.leaving
                ? '-translate-x-4 scale-[0.97] opacity-0'
                : 'animate-settle translate-x-0 scale-100 opacity-100',
              toast.tone === 'success' &&
                'border-success/30 bg-success-subtle text-foreground',
              toast.tone === 'warning' &&
                'border-warning/30 bg-warning-subtle text-foreground',
              toast.tone === 'danger' &&
                'border-danger/30 bg-danger-subtle text-foreground',
              toast.tone === 'neutral' &&
                'border-border bg-surface text-foreground',
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
