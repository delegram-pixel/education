import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[0.8125rem] font-medium leading-none transition-colors',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--color-light-gray)] text-[var(--color-primary-dark)]',
        primary: 'bg-[var(--color-primary-dark)] text-[var(--color-accent-light)] font-semibold',
        accent: 'bg-[var(--color-accent-light)] text-[var(--color-primary-dark)] font-semibold border border-[var(--color-primary-dark)]/10',
        success: 'bg-success-subtle text-[var(--color-primary-dark)] border border-success/30 font-medium',
        warning: 'bg-warning-subtle text-[var(--color-primary-dark)] border border-warning/30 font-medium',
        danger: 'bg-danger-subtle text-danger font-medium',
        outline: 'border border-[var(--color-light-gray)] text-[var(--color-primary-dark)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
