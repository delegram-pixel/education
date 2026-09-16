'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { bare?: boolean }
>(({ className, children, bare = false, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-foreground/45 backdrop-blur-[3px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in',
        'transition-opacity duration-300',
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
        'max-h-[90vh] overflow-y-auto data-[state=open]:animate-settle',
        bare
          ? 'max-w-5xl'
          : 'max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lifted',
        className,
      )}
      {...props}
    >
      {children}
      {!bare && (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-sm p-1.5 text-muted transition-colors hover:bg-sunken hover:text-foreground"
          aria-label="Close"
        >
          <X aria-hidden className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'
