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
import { readRule } from '@/lib/db/rules'
import {
  eligibilityChecks,
  personaResults,
  ticketMessages,
  tickets,
} from '@/lib/db/schema'
import { WALKTHROUGHS, getWalkthrough } from '@/lib/db/walkthroughs.data'
import { shortInstitutionName } from '@/lib/institutions'
import { generateTicketId } from '@/lib/utils'
import type {
  CheckTarget,
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

/**
 * Resolve whatever the checker was pointed at into something it can decide on.
 *
 * One function for both entry points — the `?course=` URL and the `runCheck`
 * action — so a link and a form submission cannot end up on different paths.
 *
 * A reviewed course is tried first and wins any collision. The two id spaces
 * cannot actually collide: a course slug is `medicine-unilag`, and a catalogue
 * programme is `<institutionId>:<programmeId>`. The ordering is there so that
 * adding a reviewed course can never be shadowed by a mirrored row.
 *
 * Returns null for a programme we hold no rule for, and for one whose rule we
 * tried and failed to read. Both mean the same thing to a caller — no verdict is
 * available — and the caller renders today's "we have not reviewed this" panel.
 */
export async function findCheckTarget(id: string): Promise<CheckTarget | null> {
  const course = await findCourse(id)
  if (course) {
    return {
      id: course.id,
      name: course.name,
      institution: course.institution,
      institutionShort: course.institutionShort,
      faculty: course.faculty,
      blurb: course.blurb,
      olevelRule: course.olevelRule,
      utmeRule: course.utmeRule,
      utmeCutoff: course.utmeCutoff,
      provenance: 'reviewed',
    }
  }

  // Only a catalogue programme id carries the colon, so this is the cheapest
  // possible rejection of anything else — including a stale or hand-typed id.
  if (!id.includes(':')) return null

  const { rule } = await readRule(id)
  // Null when the read failed and null when the brochure states no requirement
  // at all. The two are deliberately not told apart here: neither leaves us a
  // rule to decide on, and the caller renders the same "we have not reviewed
  // this" panel for both. `readRule` still reports which it was, for whoever is
  // watching the logs.
  if (!rule?.rule) return null

  return {
    id,
    name: rule.name,
    institution: rule.institution,
    institutionShort: shortInstitutionName(rule.institution),
    // A programme's department is not a faculty and is not dressed up as one —
    // it is what IBASS publishes, shown where a faculty would otherwise go.
    faculty: rule.department,
    // No reviewed sentence exists for a course nobody has written up, and
    // generating one would be inventing a description of a course we have not
    // looked at.
    blurb: null,
    olevelRule: rule.rule,
    // The one thing a read course does say about UTME. We hold it in the mirror
    // and, without this line, the verdict sent the student to IBASS to look up a
    // combination we were already carrying.
    utmeSubjects: rule.utmeSubjects,
    provenance: 'read',
  }
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
