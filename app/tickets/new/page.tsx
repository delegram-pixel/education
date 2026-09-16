import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

import { TicketForm } from '@/components/tickets/ticket-form'
import { Button } from '@/components/ui/button'
import { TICKET_CATEGORIES, type TicketCategory } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Ask a counselor',
  description: 'Send your question to a human counselor and get a ticket ID you can quote.',
}

function toCategory(value: string | undefined): TicketCategory {
  return TICKET_CATEGORIES.includes(value as TicketCategory)
    ? (value as TicketCategory)
    : 'other'
}

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; course?: string }>
}) {
  const { category, q, course } = await searchParams

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link href="/">
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Link>
      </Button>

      <h1 className="text-[2rem] sm:text-[2.5rem]">Ask a counselor</h1>
      <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
        Some things need a person — a result that doesn&rsquo;t match, a deadline you think
        you&rsquo;ve missed, a course change. Write it down here and you&rsquo;ll get a ticket ID
        you can quote.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6 shadow-card sm:p-8">
        <TicketForm
          defaultCategory={toCategory(category)}
          defaultBody={q ?? ''}
          courseId={course}
        />
      </div>

      <p className="mt-6 rounded-md bg-sunken px-4 py-3 text-[0.875rem] leading-relaxed text-muted">
        In this demonstration a scripted counselor replies to show how the handoff works. Replies
        are labelled <strong className="font-medium text-foreground">Demo counselor</strong> — no
        one is on duty.
      </p>
    </div>
  )
}
