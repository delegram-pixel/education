import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { RETENTION } from '@/lib/retention'
import { deleteMyData } from './actions'

export const metadata: Metadata = {
  title: 'Privacy and your data',
  description:
    'What Admission Copilot stores, how long it keeps it, and how to delete everything linked to this browser.',
}

const DELETED_MESSAGES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  ok: { tone: 'ok', text: 'Everything stored for this browser has been deleted.' },
  none: {
    tone: 'ok',
    text: 'There is no database configured on this deployment, so nothing was stored to delete.',
  },
  error: {
    tone: 'error',
    text: 'We could not complete the deletion. Please try again, or ask a counselor to remove it.',
  },
  rate: {
    tone: 'error',
    text: 'That was requested several times in a row. Please wait a moment and try again.',
  },
}

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>
}) {
  const { deleted } = await searchParams
  const status = deleted ? DELETED_MESSAGES[deleted] : undefined

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link href="/">
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Link>
      </Button>

      <h1 className="text-[2rem] sm:text-[2.5rem]">Privacy and your data</h1>
      <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
        There are no accounts here. A random number in a cookie identifies your browser, and
        everything below is attached to that number rather than to your name.
      </p>

      {status ? (
        <p
          role="status"
          className={`mt-6 rounded-md border px-4 py-3 text-[0.9375rem] ${
            status.tone === 'ok'
              ? 'border-success/25 bg-success-subtle text-foreground'
              : 'border-danger/25 bg-danger-subtle text-danger'
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <section className="mt-10 space-y-4">
        <h2 className="text-[1.375rem]">What we store</h2>
        <ul className="list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-muted">
          <li>
            <strong className="font-medium text-foreground">Eligibility checks</strong> — the
            subjects and grades you enter, the verdict, and when it was made. This is what lets a
            result be reopened or shared.
          </li>
          <li>
            <strong className="font-medium text-foreground">Quiz results</strong> — your answers and
            the interest profile they produce.
          </li>
          <li>
            <strong className="font-medium text-foreground">Tickets</strong> — the subject, the
            message you write, and the replies in the thread, so a counselor can pick it up.
          </li>
        </ul>
        <p className="text-[0.9375rem] leading-relaxed text-muted">
          We do not run advertising or third-party analytics, and we do not log grades or ticket
          bodies. Please do not put an OTP, password, PIN, card number or account credential in a
          ticket: no one here needs it, and the thread is not a safe place for it.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-[1.375rem]">How long we keep it</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-[0.9375rem]">
            <thead className="bg-sunken text-[0.8125rem] uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Record
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Kept for
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td className="px-4 py-3">Eligibility checks</td>
                <td className="px-4 py-3 text-muted">{RETENTION.checksDays} days</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Quiz results</td>
                <td className="px-4 py-3 text-muted">{RETENTION.personaDays} days</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Tickets and messages</td>
                <td className="px-4 py-3 text-muted">{RETENTION.ticketsDays} days</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Shared result links</td>
                <td className="px-4 py-3 text-muted">
                  {RETENTION.sharedResultDays} days, then they stop opening
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[0.9375rem] leading-relaxed text-muted">
          The catalogue itself is public JAMB IBASS data, and the rules we read from it are kept as
          part of the catalogue — they contain no information about you.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-[1.375rem]">Shared results</h2>
        <p className="text-[0.9375rem] leading-relaxed text-muted">
          A shared result link can be opened by anyone who has it until it expires. It is marked
          <span className="mx-1 rounded bg-sunken px-1.5 py-0.5 text-[0.8125rem] text-foreground">
            noindex
          </span>
          so search engines should not list it, but the link itself is the only protection. Share it
          the way you would share a screenshot of your result.
        </p>
      </section>

      <section className="mt-10 rounded-lg border border-border bg-surface p-6 shadow-card sm:p-8">
        <h2 className="text-[1.375rem]">Delete everything linked to this browser</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          This removes your checks, quiz results, tickets and their messages, and signs this browser
          out of its anonymous session. It cannot be undone. Ticket links you have already given to
          a counselor will stop opening.
        </p>
        <form action={deleteMyData} className="mt-5">
          <Button type="submit" variant="danger">
            <Trash2 aria-hidden className="size-4" />
            Delete my data
          </Button>
        </form>
      </section>
    </div>
  )
}
