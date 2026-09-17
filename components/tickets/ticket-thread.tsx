'use client'

import { Check, Copy, User } from 'lucide-react'
import * as React from 'react'

import { AskCopilotButton } from '@/components/swift/ask-copilot-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { simulateCounselorReply } from '@/app/tickets/actions'
import { cn } from '@/lib/utils'

type Message = {
  id: string
  author: 'student' | 'ai' | 'counselor'
  authorName: string | null
  body: string
}

const HANDOFF_DELAY_MS = 4000
const TYPING_MS_PER_CHAR = 14

/**
 * The ticket thread, including the human-handoff demonstration.
 *
 * WHAT IS REAL AND WHAT IS NOT: the ticket, its ID, and the persisted messages
 * are real. The counselor is scripted, arrives on a timer, and is labelled
 * "Demo counselor" everywhere it appears. Simulating the experience of a
 * handoff is a legitimate thing to show a judge; implying that someone is
 * actually on duty is not, so the label is not decoration and must not be
 * removed.
 *
 * The reply is typed out character by character because that is how Swift's
 * real handoff behaves — a human's reply streams into the same thread the AI
 * was using, rather than appearing as a finished block.
 */
export function TicketThread({
  ticketId,
  initialMessages,
  persisted,
}: {
  ticketId: string
  initialMessages: Message[]
  persisted: boolean
}) {
  const [messages, setMessages] = React.useState<Message[]>(initialMessages)
  const [typing, setTyping] = React.useState('')
  const [connecting, setConnecting] = React.useState(false)
  const toast = useToast()

  const alreadyReplied = messages.some((m) => m.author === 'counselor')

  React.useEffect(() => {
    if (alreadyReplied) return

    let cancelled = false
    let typeTimer: number | undefined

    const openTimer = window.setTimeout(async () => {
      if (cancelled) return
      setConnecting(true)

      const { body } = await simulateCounselorReply(ticketId)
      if (cancelled) return

      setConnecting(false)

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setMessages((current) => [
          ...current,
          { id: 'counselor', author: 'counselor', authorName: 'Demo counselor', body },
        ])
        return
      }

      let i = 0
      const type = () => {
        if (cancelled) return
        i += 1
        setTyping(body.slice(0, i))
        if (i < body.length) {
          typeTimer = window.setTimeout(type, TYPING_MS_PER_CHAR)
        } else {
          setTyping('')
          setMessages((current) => [
            ...current,
            { id: 'counselor', author: 'counselor', authorName: 'Demo counselor', body },
          ])
        }
      }
      type()
    }, HANDOFF_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(openTimer)
      if (typeTimer) window.clearTimeout(typeTimer)
    }
  }, [alreadyReplied, ticketId])

  async function copyId() {
    try {
      await navigator.clipboard.writeText(ticketId)
      toast('Ticket ID copied.', 'success')
    } catch {
      toast(`Your ticket ID is ${ticketId}.`)
    }
  }

  return (
    <div>
      {/* The ID, given the prominence it deserves — it is the one thing the
          student needs to be able to quote later. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-5 shadow-card">
        <div className="flex-1">
          <p className="text-[0.8125rem] text-muted">Your ticket ID</p>
          <p className="tabular font-display text-[1.75rem] font-semibold tracking-tight">
            {ticketId}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={copyId}>
          <Copy aria-hidden className="size-4" />
          Copy
        </Button>
      </div>

      {!persisted ? (
        <p className="mt-3 rounded-md bg-sunken px-4 py-3 text-[0.875rem] text-muted">
          This ticket has not been saved — the database is not connected in this environment. The
          conversation below still works, but it will not survive a reload.
        </p>
      ) : null}

      {/* Thread */}
      <ol className="mt-5 space-y-4">
        {messages.map((message, i) => (
          <li
            key={`${message.id}-${i}`}
            className={cn(
              'animate-settle flex gap-3',
              message.author === 'student' && 'flex-row-reverse',
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Avatar author={message.author} name={message.authorName} />
            <div
              className={cn(
                'max-w-[85%] rounded-lg border px-4 py-3',
                message.author === 'student'
                  ? 'border-primary/20 bg-primary-subtle'
                  : 'border-border bg-surface shadow-card',
              )}
            >
              <p className="mb-1 flex items-center gap-2 text-[0.8125rem] font-medium">
                {message.author === 'student' ? 'You' : (message.authorName ?? 'Copilot')}
                {message.author === 'counselor' ? (
                  <Badge tone="accent" className="px-1.5 py-0.5 text-[0.6875rem]">
                    Scripted for this demo
                  </Badge>
                ) : null}
              </p>
              <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-foreground/90">
                {message.body}
              </p>
            </div>
          </li>
        ))}

        {connecting ? (
          <li className="flex items-center gap-3 px-1 text-[0.875rem] text-muted">
            <span className="flex gap-1">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${d * 140}ms`, animationDuration: '0.9s' }}
                />
              ))}
            </span>
            Connecting you to a counselor
          </li>
        ) : null}

        {typing ? (
          <li className="flex gap-3">
            <Avatar author="counselor" name="Demo counselor" />
            <div className="max-w-[85%] rounded-lg border border-border bg-surface px-4 py-3 shadow-card">
              <p className="mb-1 flex items-center gap-2 text-[0.8125rem] font-medium">
                Demo counselor
                <Badge tone="accent" className="px-1.5 py-0.5 text-[0.6875rem]">
                  Scripted for this demo
                </Badge>
              </p>
              <p className="text-[0.9375rem] leading-relaxed text-foreground/90">
                {typing}
                <span className="animate-caret ml-0.5 inline-block h-[1.1em] w-px translate-y-[0.15em] bg-foreground" />
              </p>
            </div>
          </li>
        ) : null}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-sunken px-5 py-4">
        <p className="flex-1 text-[0.9375rem] text-muted">
          Need to add something, or send a photo of your slip?
        </p>
        <AskCopilotButton
          suggestedQuestion={`I'm following up on ticket ${ticketId}. `}
          label="Add to this conversation"
        />
      </div>
    </div>
  )
}

function Avatar({ author, name }: { author: Message['author']; name: string | null }) {
  if (author === 'counselor') {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-light)] text-[0.8125rem] font-bold text-[var(--color-primary-dark)] ring-2 ring-[var(--color-primary-dark)]/20 shadow-sm">
        {(name ?? 'DC')
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()}
      </span>
    )
  }

  if (author === 'student') {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-dark)] text-[var(--color-accent-light)] shadow-sm">
        <User aria-hidden className="size-4" />
      </span>
    )
  }

  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-dark)] text-[var(--color-accent-light)] shadow-sm">
      <Check aria-hidden className="size-4" />
    </span>
  )
}
