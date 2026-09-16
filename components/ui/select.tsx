'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value
export const SelectGroup = SelectPrimitive.Group

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'group flex h-11 w-full items-center justify-between gap-2 rounded-md',
      'border border-border-strong bg-surface px-3.5 text-left text-[1.0625rem]',
      'transition-[border-color,box-shadow] duration-200',
      'hover:border-primary data-[state=open]:border-primary',
      'data-[state=open]:ring-2 data-[state=open]:ring-primary/20',
      'data-[placeholder]:text-muted disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="truncate">{children}</span>
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        aria-hidden
        className="size-4 shrink-0 text-muted transition-transform duration-300 ease-[var(--ease-out-quint)] group-data-[state=open]:rotate-180"
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        'relative z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
        'rounded-md border border-border bg-surface shadow-lifted',
        'origin-[var(--radix-select-content-transform-origin)]',
        'data-[state=open]:animate-settle',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & { hint?: string }
>(({ className, children, hint, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center justify-between gap-3',
      'rounded-sm py-2 pl-3 pr-2.5 text-[1rem] outline-none',
      'transition-colors duration-150',
      'data-[highlighted]:bg-primary-subtle data-[highlighted]:text-primary',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="flex items-center gap-2">
      {hint ? <span className="text-[0.8125rem] text-muted">{hint}</span> : null}
      <SelectPrimitive.ItemIndicator>
        <Check aria-hidden className="size-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'
