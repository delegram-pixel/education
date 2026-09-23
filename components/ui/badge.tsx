import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[0.8125rem] font-medium leading-none transition-colors',
  {
    variants: {
      tone: {
        neutral: 'bg-sunken text-foreground',
        primary: 'bg-primary text-primary-fg font-semibold',
        accent: 'bg-accent text-accent-fg font-semibold border border-primary/10',
        success: 'bg-success-subtle text-foreground border border-success/30 font-medium',
        warning: 'bg-warning-subtle text-foreground border border-warning/30 font-medium',
        danger: 'bg-danger-subtle text-danger font-medium',
        outline: 'border border-border text-foreground',
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
