import * as React from 'react'

import { cn } from '@/lib/utils'

export function Tooltip({
  content,
  children,
  className,
}: {
  content: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-[18rem] -translate-x-1/2',
          'rounded-md border border-border bg-surface px-3 py-2 text-center text-xs font-medium leading-relaxed text-foreground shadow-lifted',
          'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {content}
      </span>
    </span>
  )
}