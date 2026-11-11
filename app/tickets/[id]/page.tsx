import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { TicketThread } from '@/components/tickets/ticket-thread'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dbConfigured } from '@/lib/db'
import { findTicket } from '@/lib/db/queries'
import { getSessionId } from '@/lib/session'
import { TICKET_CATEGORY_LABELS, type TicketCategory } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Your ticket',
  // A ticket is a private conversation. It is never a search result.
  robots: { index: false },
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await findTicket(id)

  // Ticket ids are short enough to read aloud, which also makes them guessable.
  // The id alone is therefore not authorisation: the ticket has to belong to the
  // session reading it. A missing row is a 404 when a database is configured; if
  // there is no database, the "not saved" shell below is the honest state for the
  // id the student was just shown.
  if (found) {
    const sessionId = await getSessionId()
    if (!sessionId || found.ticket.sessionId !== sessionId) notFound()
  } else if (dbConfigured) {
    notFound()
  }

  // A ticket that could not be persisted still has an ID the student was
  // shown, so the thread is rendered either way. Losing the record is not a
  // reason to show a 404 to someone holding a reference number.
  const subject = found?.ticket.subject ?? 'Your question'
  const category = (found?.ticket.category ?? 'other') as TicketCategory
  const status = found?.ticket.status ?? 'open'

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link href="/">
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Link>
      </Button>

      <div className="mb-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status === 'resolved' ? 'success' : status === 'assigned' ? 'primary' : 'accent'}>
            {status === 'assigned' ? 'With a counselor' : status === 'resolved' ? 'Resolved' : 'Open'}
          </Badge>
          <Badge tone="outline">{TICKET_CATEGORY_LABELS[category]}</Badge>
        </div>
        <h1 className="mt-3 text-[1.75rem] sm:text-[2rem]">{subject}</h1>
      </div>

      <TicketThread
        ticketId={id}
        persisted={found !== null}
        initialMessages={
          found?.messages.map((m) => ({
            id: m.id,
            author: m.author,
            authorName: m.authorName,
            body: m.body,
          })) ?? [{ id: 'local', author: 'student', authorName: null, body: subject }]
        }
      />
    </div>
  )
}
