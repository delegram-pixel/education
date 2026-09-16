/**
 * Data access.
 *
 * Every read goes through `withFallback`, so catalogue content resolves from
 * the static constants whenever Postgres is absent or erroring. Every write
 * goes through `tryWrite`, so a persistence failure is invisible to the user
 * rather than fatal.
 *
 * The `degraded` flag each read returns is surfaced quietly in the UI. It is
 * not an error state — the answer is identical either way — but hiding it
 * entirely would be dishonest about what the user is looking at.
 */

import { asc, desc, eq } from 'drizzle-orm'

import { db, tryWrite, withFallback } from '@/lib/db'
import { COURSES, getCourse } from '@/lib/db/courses.data'
import {
  eligibilityChecks,
  personaResults,
  ticketMessages,
  tickets,
} from '@/lib/db/schema'
import { WALKTHROUGHS, getWalkthrough } from '@/lib/db/walkthroughs.data'
import { generateTicketId } from '@/lib/utils'
import type {
  Course,
  CreateTicketInput,
  OLevelResult,
  PersonaProfile,
  TicketStatus,
  Verdict,
  Walkthrough,
} from '@/lib/types'

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

export async function listCourses(): Promise<{ data: Course[]; degraded: boolean }> {
  return withFallback(
    'listCourses',
    async (client) => {
      const rows = await client.query.courses.findMany()
      // An empty table means "not seeded yet", which is a fallback case, not an
      // empty catalogue. Throwing routes it through the fallback path.
      if (rows.length === 0) throw new Error('courses table is empty')
      return rows as Course[]
    },
    () => COURSES,
  )
}

export async function findCourse(id: string): Promise<Course | undefined> {
  const { data } = await listCourses()
  return data.find((c) => c.id === id) ?? getCourse(id)
}

export async function listWalkthroughs(): Promise<Walkthrough[]> {
  // Walkthrough content is static and read on every step render. It is seeded
  // for the sake of the "add an institution without a rebuild" story, but the
  // constants are the faster and more reliable read path.
  return WALKTHROUGHS
}

export async function findWalkthrough(id: string): Promise<Walkthrough | undefined> {
  return getWalkthrough(id)
}

/* -------------------------------------------------------------------------- */
/* Eligibility checks                                                          */
/* -------------------------------------------------------------------------- */

export type SavedCheck = {
  id: string
  courseId: string
  results: OLevelResult[]
  verdict: Verdict
  createdAt: Date
}

export async function saveCheck(input: {
  sessionId: string
  courseId: string
  results: OLevelResult[]
  verdict: Verdict
}): Promise<string | null> {
  const rows = await tryWrite('saveCheck', (client) =>
    client
      .insert(eligibilityChecks)
      .values(input)
      .returning({ id: eligibilityChecks.id }),
  )

  return rows?.[0]?.id ?? null
}

export async function findCheck(id: string): Promise<SavedCheck | null> {
  if (!db) return null

  try {
    const rows = await db
      .select()
      .from(eligibilityChecks)
      .where(eq(eligibilityChecks.id, id))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return {
      id: row.id,
      courseId: row.courseId,
      results: row.results,
      verdict: row.verdict,
      createdAt: row.createdAt,
    }
  } catch (error) {
    console.warn('[db] findCheck failed:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Persona                                                                     */
/* -------------------------------------------------------------------------- */

export async function savePersonaResult(input: {
  sessionId: string
  answers: Record<string, number>
  profile: PersonaProfile
  alignmentByCourse: Record<string, number>
}): Promise<void> {
  await tryWrite('savePersonaResult', (client) => client.insert(personaResults).values(input))
}

/* -------------------------------------------------------------------------- */
/* Tickets                                                                     */
/* -------------------------------------------------------------------------- */

export type TicketRecord = {
  id: string
  category: string
  subject: string
  body: string
  status: TicketStatus
  courseId: string | null
  createdAt: Date
}

export type TicketMessageRecord = {
  id: string
  author: 'student' | 'ai' | 'counselor'
  authorName: string | null
  body: string
  createdAt: Date
}

/**
 * Create a ticket.
 *
 * The ID is generated in application code rather than by the database, because
 * the user is shown it immediately and must receive one even when persistence
 * fails. A ticket the student can quote is more useful than a row they cannot
 * see.
 */
export async function createTicket(input: CreateTicketInput & { sessionId: string }): Promise<string> {
  const id = generateTicketId()

  await tryWrite('createTicket', async (client) => {
    await client.insert(tickets).values({
      id,
      sessionId: input.sessionId,
      courseId: input.courseId ?? null,
      category: input.category,
      subject: input.subject,
      body: input.body,
      status: 'open',
    })

    await client.insert(ticketMessages).values({
      ticketId: id,
      author: 'student',
      body: input.body,
    })
  })

  return id
}

export async function findTicket(
  id: string,
): Promise<{ ticket: TicketRecord; messages: TicketMessageRecord[] } | null> {
  if (!db) return null

  try {
    const rows = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1)
    const ticket = rows[0]
    if (!ticket) return null

    const messages = await db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, id))
      .orderBy(asc(ticketMessages.createdAt))

    return { ticket, messages }
  } catch (error) {
    console.warn('[db] findTicket failed:', error)
    return null
  }
}

export async function listSessionTickets(sessionId: string): Promise<TicketRecord[]> {
  if (!db) return []

  try {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.sessionId, sessionId))
      .orderBy(desc(tickets.createdAt))
      .limit(10)
  } catch (error) {
    console.warn('[db] listSessionTickets failed:', error)
    return []
  }
}

export async function addTicketMessage(input: {
  ticketId: string
  author: 'student' | 'ai' | 'counselor'
  authorName?: string
  body: string
}): Promise<void> {
  await tryWrite('addTicketMessage', async (client) => {
    await client.insert(ticketMessages).values({
      ticketId: input.ticketId,
      author: input.author,
      authorName: input.authorName ?? null,
      body: input.body,
    })
    await client
      .update(tickets)
      .set({ updatedAt: new Date(), status: input.author === 'counselor' ? 'assigned' : undefined })
      .where(eq(tickets.id, input.ticketId))
  })
}

export { WALKTHROUGHS, COURSES }
