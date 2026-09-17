import * as React from 'react'

import { cn } from '@/lib/utils'

export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-[var(--color-light-gray)] bg-surface shadow-card overflow-hidden',
        interactive && [
          'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-quint)]',
          'hover:-translate-y-1 hover:shadow-lifted hover:border-border-strong',
          'after:pointer-events-none after:absolute after:inset-0 after:bg-[var(--color-primary-dark)] after:opacity-0 after:transition-opacity after:duration-200 hover:after:opacity-[0.04]',
          'motion-reduce:hover:translate-y-0',
        ],
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-6 pb-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-xl font-semibold', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[0.9375rem] leading-relaxed text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 p-6 pt-0', className)} {...props} />
}
