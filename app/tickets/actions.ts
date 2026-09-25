'use server'

import { redirect } from 'next/navigation'

import { addTicketMessage, createTicket, findTicket } from '@/lib/db/queries'
import { ensureSessionId } from '@/lib/session'
import { createTicketSchema, type TicketCategory } from '@/lib/types'

export type TicketFormState = { error: string } | null

export async function submitTicket(
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const parsed = createTicketSchema.safeParse({
    category: formData.get('category'),
    subject: formData.get('subject'),
    body: formData.get('body'),
    courseId: formData.get('courseId') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check what you have written.' }
  }

  const sessionId = await ensureSessionId()
  const id = await createTicket({ ...parsed.data, sessionId })

  redirect(`/tickets/${id}`)
}

/**
 * The counselor replies used in the admissions support handoff.
 *
 * These are written, not generated: a clear, human-sounding reply is more
 * honest about what is being shown than an improvised one that might claim to
 * have checked a document nobody has actually seen.
 */
const SCRIPTED_REPLIES: Record<TicketCategory, string> = {
  eligibility_dispute:
    "I've read your check and I can see why it flagged. Send me a photo of your original result slip in this thread and I'll go through it line by line with you — if a grade has been entered differently from what's printed, that's a five-minute fix.",
  result_discrepancy:
    "Thanks for flagging this. A discrepancy between your slip and what the portal shows needs to go through your exam body rather than the university, and there's a specific form for it. Send me the photo and I'll tell you exactly which one and what to write.",
  course_change:
    "Changing course is very doable, and you have more room than most people think. Tell me which course you're moving to and whether you've already sat the UTME, and I'll tell you whether it's a change of course, a change of institution, or both.",
  deadline:
    "Let's find out where you actually stand before assuming it's closed. Tell me the date you last logged in and what the portal said, and I'll check whether there's a late window or a supplementary list you can still get onto.",
  registration_help:
    "I do this one a lot. Tell me which step you're on and what the screen says, word for word, and I'll get you past it. If it's the NIN name mismatch, don't pay for anything else until we've sorted that.",
  other:
    "Thanks for writing in with the detail — it helps. Give me a little more on what you've already tried and I'll pick this up from there.",
}

/**
 * Record the counselor's reply for the handoff demonstration.
 *
 * It is written to the database so that reloading the page shows a real thread
 * rather than replaying an animation. Idempotent: if a counselor has already
 * replied, this does nothing, so a double-invoked effect cannot post twice.
 */
export async function simulateCounselorReply(
  ticketId: string,
): Promise<{ posted: boolean; body: string }> {
  const existing = await findTicket(ticketId)

  const body =
    SCRIPTED_REPLIES[(existing?.ticket.category as TicketCategory) ?? 'other'] ??
    SCRIPTED_REPLIES.other

  if (existing?.messages.some((m) => m.author === 'counselor')) {
    return { posted: false, body }
  }

  await addTicketMessage({
    ticketId,
    author: 'counselor',
    authorName: 'Support counselor',
    body,
  })

  return { posted: true, body }
}
