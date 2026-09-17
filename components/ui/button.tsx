import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const button = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-medium select-none isolate overflow-hidden',
    'transition-[transform,background-color,border-color,color,box-shadow]',
    'duration-200 ease-[var(--ease-out-quint)]',
    'active:scale-[0.985] active:duration-75',
    'disabled:pointer-events-none disabled:opacity-45',
    // The sheen: a single highlight that sweeps across on hover. One pseudo
    // element, no library, and it costs nothing when reduced motion is on.
    'before:absolute before:inset-0 before:-translate-x-full before:skew-x-12',
    'before:bg-gradient-to-r before:from-transparent before:via-white/18 before:to-transparent',
    'before:transition-transform before:duration-700 before:ease-[var(--ease-out-quint)]',
    'hover:before:translate-x-full motion-reduce:before:hidden',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-fg hover:bg-primary-hover shadow-card',
        secondary:
          'bg-accent text-accent-fg hover:bg-accent-hover border border-transparent shadow-card font-semibold',
        ghost:
          'bg-transparent text-foreground border-2 border-border hover:bg-primary-subtle before:hidden',
        subtle:
          'bg-accent-subtle text-foreground hover:bg-accent',
        danger: 'bg-danger-subtle text-danger hover:bg-danger hover:text-white',
      },
      size: {
        sm: 'h-11 min-h-[44px] rounded-md px-3.5 text-[0.9375rem]',
        md: 'h-11 min-h-[44px] rounded-md px-5 text-[1.0625rem]',
        lg: 'h-14 min-h-[44px] rounded-lg px-7 text-[1.125rem]',
        icon: 'size-11 min-h-[44px] min-w-[44px] rounded-md',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp ref={ref} className={cn(button({ variant, size }), className)} {...props}>
        {children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

/**
 * The arrow that walks forward on hover. Pair with any button via
 * `<Button><span>Label</span><Arrow /></Button>`.
 */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn(
        'size-[1.1em] shrink-0 transition-transform duration-300 ease-[var(--ease-out-quint)]',
        'group-hover:translate-x-1 motion-reduce:transition-none',
        className,
      )}
    >
      <path
        d="M4 10h11M11 6l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export { button as buttonVariants }
