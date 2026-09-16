'use client'

import { Loader2, Send } from 'lucide-react'
import * as React from 'react'

import { Arrow, Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { submitTicket, type TicketFormState } from '@/app/tickets/actions'
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, type TicketCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

const fieldClasses = cn(
  'w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-[1.0625rem]',
  'transition-[border-color,box-shadow] duration-200',
  'placeholder:text-muted/70 hover:border-primary',
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
)

export function TicketForm({
  defaultCategory,
  defaultBody,
  courseId,
}: {
  defaultCategory: TicketCategory
  defaultBody: string
  courseId?: string
}) {
  const [state, action, pending] = React.useActionState<TicketFormState, FormData>(
    submitTicket,
    null,
  )
  const [category, setCategory] = React.useState<TicketCategory>(defaultCategory)
  const [body, setBody] = React.useState(defaultBody)

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="category" value={category} />
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}

      <div className="space-y-2">
        <Label htmlFor="category-trigger">What is this about?</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
          <SelectTrigger id="category-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {TICKET_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Give it a short title</Label>
        <input
          id="subject"
          name="subject"
          required
          maxLength={120}
          defaultValue={TICKET_CATEGORY_LABELS[defaultCategory]}
          placeholder="Physics grade on my slip does not match"
          className={fieldClasses}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Tell us what happened</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={6}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Include anything you have already tried, and what the screen said."
          className={cn(fieldClasses, 'resize-y leading-relaxed')}
        />
        <p className="text-[0.8125rem] text-muted">
          {body.length}/2000 &middot; The more detail you give, the less back-and-forth you&rsquo;ll need.
        </p>
      </div>

      {state?.error ? (
        <p className="rounded-md border border-danger/25 bg-danger-subtle px-4 py-3 text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="group">
        {pending ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Sending
          </>
        ) : (
          <>
            <Send aria-hidden className="size-4" />
            Send to a counselor
            <Arrow />
          </>
        )}
      </Button>
    </form>
  )
}
