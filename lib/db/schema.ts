/**
 * Drizzle schema for Neon Postgres.
 *
 * Two kinds of table live here, and the distinction is deliberate:
 *
 *   Catalogue  — courses, walkthroughs, steps. Static content, seeded from the
 *                `*.data.ts` constants. Stored in Postgres so new courses and
 *                institutions can be added without a rebuild, but always
 *                readable from the constants when the database is unreachable.
 *
 *   Records    — eligibility checks, persona results, tickets, messages. These
 *                are genuinely dynamic and have no fallback: if the database is
 *                down the app degrades to not persisting them, rather than
 *                failing.
 */

import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import type {
  Hotspot,
  OLevelResult,
  OLevelRule,
  PersonaProfile,
  ProgrammeRuleStatus,
  RuleConfidence,
  TicketCategory,
  TicketStatus,
  UtmeRule,
  Verdict,
} from '@/lib/types'

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

export const courses = pgTable('courses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  institution: text('institution').notNull(),
  institutionShort: text('institution_short').notNull(),
  faculty: text('faculty').notNull(),
  durationYears: integer('duration_years').notNull(),
  /** Indicative and prior-year. The UI must label it as such. */
  utmeCutoff: integer('utme_cutoff').notNull(),
  blurb: text('blurb').notNull(),
  reality: text('reality').notNull(),
  olevelRule: jsonb('olevel_rule').$type<OLevelRule>().notNull(),
  utmeRule: jsonb('utme_rule').$type<UtmeRule>().notNull(),
  personaProfile: jsonb('persona_profile').$type<PersonaProfile>().notNull(),
})

/**
 * Read-only mirror of JAMB's IBASS brochure.
 *
 * These rows deliberately live apart from `courses`: IBASS is the national
 * discovery catalogue, while `courses` contains the smaller set whose rules
 * we have reviewed well enough to run an automated eligibility verdict.
 */
export const catalogueInstitutions = pgTable('catalogue_institutions', {
  /** JAMB's stable institution identifier. */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  institutionType: text('institution_type'),
  category: text('category'),
  state: text('state'),
  sourceUrl: text('source_url').notNull(),
  sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }).notNull(),
})

export const catalogueProgrammes = pgTable(
  'catalogue_programmes',
  {
    /** JAMB's programme identifier, namespaced with the institution id. */
    id: text('id').primaryKey(),
    institutionId: text('institution_id')
      .notNull()
      .references(() => catalogueInstitutions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    department: text('department'),
    status: text('status'),
    utmeSubjects: jsonb('utme_subjects').$type<string[]>().notNull().default([]),
    olevelRequirements: text('olevel_requirements'),
    directEntryRequirements: text('direct_entry_requirements'),
    remarks: text('remarks'),
    sourceUrl: text('source_url').notNull(),
    sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('catalogue_programmes_institution_idx').on(t.institutionId)],
)

/**
 * Our reading of a catalogue programme's requirement prose.
 *
 * Deliberately a separate table rather than columns on `catalogue_programmes`.
 * That table is a faithful mirror of what IBASS published — we copy their
 * sentence word for word, HTML and all, and never edit it. A rule is our
 * *derivation* from that sentence, which is a different kind of claim about the
 * same programme. Keeping the two apart means a re-import cannot clobber a
 * rule, and the mirror stays honest about being only a mirror.
 */
export const programmeRules = pgTable('programme_rules', {
  /**
   * The programme's own id — a rule is one per programme by definition, so this
   * is the primary key rather than a foreign key beside a generated one.
   */
  programmeId: text('programme_id')
    .primaryKey()
    .references(() => catalogueProgrammes.id, { onDelete: 'cascade' }),
  /** Null exactly when `status` is 'no-source'. */
  olevelRule: jsonb('olevel_rule').$type<OLevelRule>(),
  status: text('status').$type<ProgrammeRuleStatus>().notNull(),
  /**
   * The prose the rule was read from, as plain text rather than as the HTML it
   * arrived in. This is what makes a stored rule auditable — you can read the
   * sentence it came from without opening the brochure.
   */
  sourceText: text('source_text'),
  /**
   * A digest of `sourceText`. When IBASS rewords a requirement, this stops
   * matching what the mirror now holds, which is how every rule built from the
   * old wording can be found.
   */
  sourceHash: text('source_hash'),
  confidence: text('confidence').$type<RuleConfidence>().notNull(),
  /** Which model produced it. Provenance, for when a better one arrives. */
  model: text('model').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const walkthroughs = pgTable('walkthroughs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  estimatedMinutes: integer('estimated_minutes').notNull(),
  bringWithYou: jsonb('bring_with_you').$type<string[]>().notNull(),
})

export const steps = pgTable(
  'steps',
  {
    id: text('id').primaryKey(),
    walkthroughId: text('walkthrough_id')
      .notNull()
      .references(() => walkthroughs.id, { onDelete: 'cascade' }),
    order: integer('step_order').notNull(),
    title: text('title').notNull(),
    instruction: text('instruction').notNull(),
    screenshotUrl: text('screenshot_url').notNull(),
    /** Percentages, not pixels — see the Hotspot type. */
    hotspot: jsonb('hotspot').$type<Hotspot | null>(),
    tip: text('tip'),
    defines: jsonb('defines').$type<{ term: string; meaning: string }[]>(),
  },
  (t) => [index('steps_walkthrough_idx').on(t.walkthroughId, t.order)],
)

/* -------------------------------------------------------------------------- */
/* Records                                                                     */
/* -------------------------------------------------------------------------- */

export const eligibilityChecks = pgTable(
  'eligibility_checks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Anonymous visitor id from a cookie. There are no accounts in this MVP. */
    sessionId: text('session_id').notNull(),
    courseId: text('course_id').notNull(),
    results: jsonb('results').$type<OLevelResult[]>().notNull(),
    verdict: jsonb('verdict').$type<Verdict>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('checks_session_idx').on(t.sessionId)],
)

export const personaResults = pgTable(
  'persona_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: text('session_id').notNull(),
    answers: jsonb('answers').$type<Record<string, number>>().notNull(),
    profile: jsonb('profile').$type<PersonaProfile>().notNull(),
    alignmentByCourse: jsonb('alignment_by_course').$type<Record<string, number>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('persona_session_idx').on(t.sessionId)],
)

export const tickets = pgTable(
  'tickets',
  {
    /** Human-readable and speakable over a phone, e.g. AC-7F3K2. */
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    courseId: text('course_id'),
    category: text('category').$type<TicketCategory>().notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').$type<TicketStatus>().notNull().default('open'),
    /** Swift Agents' own ticket reference, when the escalation originated there. */
    swiftTicketRef: text('swift_ticket_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('tickets_session_idx').on(t.sessionId)],
)

export const ticketMessages = pgTable(
  'ticket_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    author: text('author').$type<'student' | 'ai' | 'counselor'>().notNull(),
    authorName: text('author_name'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('messages_ticket_idx').on(t.ticketId, t.createdAt)],
)
