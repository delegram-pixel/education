import { and, asc, count, eq, ilike, max, or, sql, type SQL } from 'drizzle-orm'

import { db } from '@/lib/db'
import { SAMPLE_CATALOGUE_PROGRAMMES, SAMPLE_INSTITUTION_DETAILS } from '@/lib/db/catalogue.data'
import { COURSES } from '@/lib/db/courses.data'
import { listCourses } from '@/lib/db/queries'
import { catalogueInstitutions, catalogueProgrammes, programmeRules } from '@/lib/db/schema'
import { nameKey, reviewedCourseIndex } from '@/lib/discovery'
import { subjectName, type Course, type ProgrammeRuleStatus, type SubjectCode } from '@/lib/types'

export type SwiftKnowledgeProgramme = {
  institution: string
  programme: string
  department: string | null
  status: string | null
  utmeSubjects: string[]
  /**
   * The brochure's prose for this programme, present only on a read that asked
   * for it — see `PROSE_COLUMNS`. Absent, not null, when it was not read.
   */
  olevelRequirements?: string | null
  directEntryRequirements?: string | null
  remarks?: string | null
  sourceUrl: string
  sourceUpdatedAt: Date
  /**
   * The reviewed course this row is backed by, when there is one.
   *
   * Set only on the sample rows built from `courses.data.ts`. A mirrored IBASS
   * row leaves it null and is joined to a reviewed course by name instead — see
   * `matchProgrammes`. Non-null here is what entitles discovery to offer a link
   * into the checker rather than only "go and read the brochure".
   */
  reviewedCourseId?: string | null
  /**
   * The mirror's own identifier for this row — `<institutionId>:<programmeId>`.
   *
   * Null on the sample rows, which are reviewed courses and are reached by their
   * course id. A mirrored row needs this because it is what a rule is stored
   * against and what `/check?course=` resolves.
   */
  programmeId?: string | null
  /**
   * Whether a rule has already been read for this programme.
   *
   * Null when nobody has read one yet, which is the picker's cue to go and read
   * it. Distinct from `'no-source'`, which means the reading was done and the
   * brochure had nothing to say — a programme in that state is settled and must
   * not be re-read on every selection.
   */
  ruleStatus?: ProgrammeRuleStatus | null
  /**
   * The institution this programme sits under, by its catalogue id.
   *
   * Carried so a caller can link back to the school without matching on its
   * name — the API needs it to answer "everything under this institution"
   * without a second lookup per row.
   */
  institutionId?: string | null
}

/**
 * An institution in the discovery catalogue.
 *
 * Deliberately not a `Course`: this is a place programmes are listed under, not
 * something the eligibility engine can decide on. `programmeCount` is what the
 * catalogue currently holds, which is not a claim about what the school offers.
 */
export type CatalogueInstitution = {
  /** JAMB's identifier when mirrored; derived from the name for sample rows. */
  id: string
  name: string
  institutionType: string | null
  category: string | null
  state: string | null
  programmeCount: number
  sourceUrl: string
  sourceUpdatedAt: Date
}

/**
 * The no-database catalogue: the reviewed courses plus the sample IBASS-style
 * rows.
 *
 * Assembled here rather than inline so the programme list and the institution
 * list below are built from one array and cannot disagree about who is in the
 * catalogue or how many programmes each of them lists.
 */
function sampleProgrammes(): SwiftKnowledgeProgramme[] {
  return [
    ...COURSES.map((course) => ({
      institution: course.institution,
      programme: course.name,
      department: course.faculty,
      status: 'sample — reviewed by Admission Copilot',
      // Published as names, not codes: this document is read by a crawler and
      // quoted back to students, and "ENG, MTH, BIO" is neither.
      utmeSubjects: [...course.utmeRule.compulsory, ...course.utmeRule.chooseFrom].map(subjectName),
      olevelRequirements: `${course.olevelRule.minCredits} credits including ${course.olevelRule.mandatory
        .map(subjectName)
        .join(', ')}`,
      directEntryRequirements: null,
      remarks: 'Use the institution bulletin and JAMB IBASS to confirm the current session.',
      sourceUrl: 'https://ibass.jamb.gov.ng/brochure-by-institution',
      sourceUpdatedAt: new Date(0),
      reviewedCourseId: course.id,
    })),
    ...SAMPLE_CATALOGUE_PROGRAMMES,
  ]
}

/**
 * Stable key for an institution the mirror gave us no identifier for.
 *
 * Exported because the API publishes it: a programme row carries the slug of its
 * institution when the mirror gave it no id, and a caller has to be able to
 * reach the institution from the programme. One implementation, so a slug the
 * API hands out and the slug `sampleInstitutions` keys on cannot diverge.
 */
export function institutionSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * What marks an identifier as naming a constant rather than a mirrored row.
 *
 * Load-bearing, not decorative: `findProgrammeById` switches on it to decide
 * whether to ask the mirror or the constants, so an id can never be looked up in
 * the wrong one of the two.
 */
const SAMPLE_PROGRAMME_PREFIX = 'sample:'

/**
 * The identifier the API publishes for a programme.
 *
 * A mirrored row has JAMB's own id, which is what a rule is stored against and
 * what `/check?course=` resolves — so it is used verbatim and a client holding
 * one is holding something that survives a re-import. A sample row has no such
 * id, so one is derived from the institution and the programme name; those rows
 * exist only on the no-database path, where the catalogue is a handful of
 * hand-written entries and the name really does identify one offering.
 */
export function programmeRef(programme: SwiftKnowledgeProgramme): string {
  return (
    programme.programmeId ||
    `${SAMPLE_PROGRAMME_PREFIX}${institutionSlug(programme.institution)}:${institutionSlug(
      programme.programme,
    )}`
  )
}

function sampleInstitutions(programmes: SwiftKnowledgeProgramme[]): CatalogueInstitution[] {
  const byName = new Map<string, CatalogueInstitution>()

  for (const programme of programmes) {
    const existing = byName.get(programme.institution)
    if (existing) {
      existing.programmeCount += 1
      continue
    }

    const details = SAMPLE_INSTITUTION_DETAILS[programme.institution]

    byName.set(programme.institution, {
      id: institutionSlug(programme.institution),
      name: programme.institution,
      institutionType: details?.institutionType ?? null,
      category: null,
      state: details?.state ?? null,
      programmeCount: 1,
      sourceUrl: programme.sourceUrl,
      sourceUpdatedAt: programme.sourceUpdatedAt,
    })
  }

  return [...byName.values()]
}

/**
 * The columns a listing needs, and the only ones most callers may have.
 *
 * Deliberately excludes the brochure prose in `PROSE_COLUMNS` below. Every read
 * that goes through here is one a student is waiting on, and the prose is by far
 * the largest thing in a catalogue row — so the cheap read is the default and
 * asking for more is something a caller has to say out loud.
 */
const LISTING_COLUMNS = {
  id: catalogueProgrammes.id,
  institutionId: catalogueProgrammes.institutionId,
  institution: catalogueInstitutions.name,
  programme: catalogueProgrammes.name,
  department: catalogueProgrammes.department,
  status: catalogueProgrammes.status,
  utmeSubjects: catalogueProgrammes.utmeSubjects,
  sourceUrl: catalogueProgrammes.sourceUrl,
  sourceUpdatedAt: catalogueProgrammes.sourceUpdatedAt,
  ruleStatus: programmeRules.status,
} as const

/** The brochure prose for one programme, as mirrored. */
type ProgrammeProse = {
  olevelRequirements: string | null
  directEntryRequirements: string | null
  remarks: string | null
}

/**
 * The brochure's own prose for a programme, exactly as mirrored.
 *
 * Word-generated HTML at roughly 15KB a programme — an order of magnitude more
 * than every other column in the row combined. Exactly one caller renders it:
 * the Swift knowledge document, which is a cached crawler endpoint rather than
 * anything a student waits on.
 *
 * WHY THIS IS NOT PART OF THE LISTING READ: selecting it for a school's
 * programme list meant one click on the school picker transferred megabytes the
 * picker never looks at — `InstitutionProgramme` carries none of these three
 * fields — and a transfer that size on a slow connection is killed before it
 * finishes, which is how a listing became a forty-second request that ended in
 * the static fallback. Reading a column nobody renders is not free; it is paid
 * for by whoever is waiting.
 */
const PROSE_COLUMNS = {
  olevelRequirements: catalogueProgrammes.olevelRequirements,
  directEntryRequirements: catalogueProgrammes.directEntryRequirements,
  remarks: catalogueProgrammes.remarks,
} as const satisfies Record<keyof ProgrammeProse, unknown>

/**
 * A search term as a `LIKE` pattern, with the wildcards in it escaped.
 *
 * Postgres reads `%` and `_` in a `LIKE` pattern as instructions, so a student
 * searching for "100% science" or a programme with an underscore in its name
 * would otherwise send a pattern rather than a term — matching far more than
 * they asked for, or nothing at all. Backslash is `LIKE`'s default escape, and
 * escaping it first is what makes the rest of the substitution correct.
 */
export function likePattern(value: string): string {
  return `%${likeLiteral(value)}%`
}

/**
 * A value as a `LIKE` pattern that matches itself and nothing else.
 *
 * The same escaping as `likePattern` without the surrounding wildcards, for the
 * filters that mean "this exact value, ignoring case" rather than "contains this
 * text": `ilike` with a wildcard-free pattern is a case-insensitive equality.
 *
 * The escaping is not decoration. `?state=%` is a client whose filter was built
 * from an empty form field, and unescaped it is a pattern that matches every
 * institution in the catalogue — where the same filter on the in-memory path
 * (`filterInstitutions`) matches none. Two paths through one API disagreeing
 * about what a filter means is the failure this module exists to prevent.
 */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

/**
 * What narrows a programme read, in one place.
 *
 * Pulled out because three queries now need the same narrowing — the listing,
 * the count that tells a client how many rows there are in total, and the prose
 * read — and three copies of a filter is three chances for the page a client
 * walks and the total it was promised to disagree about which rows exist.
 *
 * Both doors in are here. A school is reachable by the name IBASS publishes for
 * it and by JAMB's id for it, and callers arrive holding one or the other: the
 * checker's school picker has a name, the API has an id.
 *
 * The API's three wider filters are here too, and deliberately so: each one has
 * to apply to the count as well as the page, or a client would be told there are
 * four hundred matches and then handed the twelve that also survived a filter
 * the total never saw.
 */
function programmeFilter(options: {
  institutionName?: string
  institutionId?: string
  /** A state name, matched against the institution's recorded state. */
  state?: string
  /** Free text over the programme name and the institution's name. */
  q?: string
  /** A subject *name* — see `subjectFilter`, which resolves the code first. */
  subjectName?: string
}): SQL | undefined {
  const term = options.q?.trim()

  const clauses = [
    options.institutionName ? eq(catalogueInstitutions.name, options.institutionName) : undefined,
    options.institutionId ? eq(catalogueProgrammes.institutionId, options.institutionId) : undefined,
    // `ilike` on both names rather than only the programme's: a student typing a
    // school's name into the programme search means to narrow to that school.
    // The term is one contiguous substring, not a parsed query: `q=UNIVERSITY OF
    // LAGOS` narrows to that school and `q=nursing` finds Nursing programmes,
    // but `q=UNILAG nursing` matches nothing — "UNILAG" is not a substring of
    // the name IBASS publishes. Combining the two is `?q=nursing&state=Lagos`,
    // with separate parameters, and the docs say so.
    // A wildcard-free `ilike`, so this is the same case-insensitive equality
    // `filterInstitutions` applies on `/institutions` — `?state=Lagos` selects
    // Lagos on both endpoints, and `?state=River` selects nothing on both rather
    // than matching Rivers on one of them.
    options.state ? ilike(catalogueInstitutions.state, likeLiteral(options.state)) : undefined,
    term
      ? or(ilike(catalogueProgrammes.name, likePattern(term)), ilike(catalogueInstitutions.name, likePattern(term)))
      : undefined,
    // The UTME combination is a jsonb array of the labels IBASS publishes —
    // "Biology", "Government/History", "Data Processing/Computer Studies". It is
    // matched as text rather than by array containment because the labels are
    // free text with their own punctuation and spacing, and an exact element
    // match would miss "Biology " for the space. Imprecise in principle, right in
    // practice, and cheap: a false positive here is a programme the student can
    // see does not list their subject.
    options.subjectName
      ? sql`${catalogueProgrammes.utmeSubjects}::text ILIKE ${likePattern(options.subjectName)}`
      : undefined,
  ].filter((clause): clause is SQL => clause !== undefined)

  return clauses.length ? and(...clauses) : undefined
}

/**
 * The same filter, applied in memory, for the no-database path.
 *
 * A second implementation, which the file otherwise avoids — but the alternative
 * is worse. Without it a deployment with no `DATABASE_URL` would ignore the
 * client's filters and answer a question about Lagos with the national sample,
 * which is a wrong answer rather than a degraded one.
 *
 * KEPT HONEST BY HAND, with eyes open. `catalogue.test.ts` pins this side against
 * the sample rows, but it cannot pin the two against each other: the SQL path
 * needs a database, so no test in this repo runs one case through both. The one
 * place the two are known to meet is the wildcard question — an escaped `LIKE`
 * matches nothing where an unescaped one matches everything — and both sides
 * answer it the same way, because both escape. See `likeLiteral`.
 */
function sampleMatches(
  programme: SwiftKnowledgeProgramme,
  filter: { institutionName?: string; institutionId?: string; state?: string; q?: string; subjectName?: string },
): boolean {
  if (filter.institutionName && programme.institution !== filter.institutionName) return false

  if (filter.institutionId && institutionSlug(programme.institution) !== filter.institutionId) {
    return false
  }

  if (filter.state) {
    // A row we cannot place does not match a state filter. Filtering by Lagos and
    // being handed a school with no recorded state would be worse than being
    // handed fewer rows.
    const state = SAMPLE_INSTITUTION_DETAILS[programme.institution]?.state
    if (!state || state.toLowerCase() !== filter.state.toLowerCase()) return false
  }

  if (filter.q) {
    const needle = filter.q.toLowerCase()
    const haystack = `${programme.programme} ${programme.institution}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }

  if (filter.subjectName) {
    const needle = filter.subjectName.toLowerCase()
    if (!programme.utmeSubjects.some((label) => label.toLowerCase().includes(needle))) return false
  }

  return true
}

/**
 * How many programmes match, without reading them.
 *
 * `programme_rules` is left out of the join on purpose. Its `programme_id` is
 * the primary key — a rule is one per programme by definition, as the schema
 * says — so it cannot multiply a row and cannot change this number. Counting
 * through a join that cannot affect the count is a slower way to get the same
 * answer, and one more place for the two queries to drift.
 */
async function countProgrammes(where: SQL | undefined): Promise<number> {
  const [row] = await db!
    .select({ value: count() })
    .from(catalogueProgrammes)
    .innerJoin(
      catalogueInstitutions,
      eq(catalogueProgrammes.institutionId, catalogueInstitutions.id),
    )
    .where(where)

  return row?.value ?? 0
}

/**
 * Read programme rows, optionally narrowed to a single institution and paged.
 *
 * One reader rather than two, so the column list, the join and the sample
 * fallback exist once and cannot drift apart between the whole-catalogue view
 * and the per-institution one.
 *
 * The narrowing happens in SQL. The national catalogue runs past twenty thousand
 * programmes, and pulling every one of them across the wire to render a single
 * school's thirty is the kind of mistake that costs nothing at three sample rows
 * and a great deal at full size.
 *
 * Paging also happens in SQL, and it has to. This reader used to return the
 * whole match set and leave the slicing to whoever asked; that is fine for a
 * caller rendering one school and ruinous for a public endpoint, where one
 * request for page two would transfer the entire catalogue and then throw
 * nineteen twentieths of it away.
 *
 * Returning `total` is what makes a paged read safe to expose. Without it a
 * client holding a hundred-row page cannot tell "this is everything" from "this
 * is the first hundred of twenty thousand" — the exact confusion the knowledge
 * document avoids by stating its own cap.
 */
async function readProgrammes(
  options: {
    /** Narrow to one institution, by the name IBASS publishes for it. */
    institutionName?: string
    /** Narrow to one institution by its catalogue id — the API's other door in. */
    institutionId?: string
    /** Narrow to institutions in one state. */
    state?: string
    /** Free text over the programme and institution names. */
    q?: string
    /** A subject *code*, as `/subjects` publishes them. Resolved to a name here. */
    subject?: SubjectCode
    /**
     * Also read the brochure prose. False unless a caller renders it — see
     * `PROSE_COLUMNS`, which is the whole case for this flag existing.
     */
    prose?: boolean
    /**
     * How many rows to return. Omit for every match, which is what the knowledge
     * document and the subject search both want and what neither should stop
     * wanting: both read the catalogue whole by design, one to render it and one
     * to match against it.
     */
    limit?: number
    /** Where to start. Ignored when no `limit` is given. */
    offset?: number
  } = {},
): Promise<{
  programmes: SwiftKnowledgeProgramme[]
  source: 'ibass' | 'sample'
  /** How many rows matched, before the page was taken. */
  total: number
}> {
  const { institutionName, institutionId, prose = false, limit, offset = 0 } = options
  const state = options.state?.trim() || undefined
  const q = options.q?.trim() || undefined
  // A code that names no subject we know would otherwise match nothing and look
  // like an empty catalogue. `undefined` here means "the caller named a code we
  // do not publish", and the API refuses it rather than answering it emptily.
  //
  // Not trimmed or upper-cased here: `SubjectCode` is a closed union, and
  // `lib/api/params.ts` has already validated and normalised the raw query
  // string before it reaches this reader. Doing it again would widen the type to
  // `string` and lose the check that the code is one we publish.
  const subject = options.subject
  const subjectNameFor = subject ? subjectName(subject) : undefined
  const filter = { institutionName, institutionId, state, q, subjectName: subjectNameFor }
  const where = programmeFilter(filter)

  /**
   * Whether the caller asked a specific question, which is what decides what an
   * empty result means — see the note on the guard below.
   */
  const filtered = Boolean(institutionName || institutionId || state || q || subjectNameFor)

  /** The same page, taken off the constants instead of off SQL. */
  const samplePage = <T>(rows: T[]): T[] =>
    limit === undefined ? rows.slice(offset) : rows.slice(offset, offset + limit)

  if (db) {
    try {
      const matches = db
        .select(LISTING_COLUMNS)
        .from(catalogueProgrammes)
        .innerJoin(catalogueInstitutions, eq(catalogueProgrammes.institutionId, catalogueInstitutions.id))
        // LEFT, because the ordinary case is a programme nobody has read a rule
        // for yet. An inner join would hide every programme the picker most needs
        // to offer — the ones a read could still open up.
        .leftJoin(programmeRules, eq(programmeRules.programmeId, catalogueProgrammes.id))
        .where(where)
        // The id last, so the order is total. Offset paging is only correct over
        // an order that does not shuffle between requests: two programmes at one
        // institution with the same name would otherwise be free to swap places
        // between page one and page two, and a client walking the list would see
        // one of them twice and the other never.
        .orderBy(
          asc(catalogueInstitutions.name),
          asc(catalogueProgrammes.name),
          asc(catalogueProgrammes.id),
        )

      const rows = limit === undefined ? await matches : await matches.limit(limit).offset(offset)

      // An empty result means opposite things in the two cases. With no filter at
      // all it means the mirror holds nothing and the sample rows are the honest
      // answer. With a filter it means the mirror is fine and simply nothing
      // matched — so it is returned as IBASS and left empty, rather than papered
      // over with sample rows that would credit us with knowing something we do
      // not, and would answer a question about Lagos with a national constant.
      if (rows.length || filtered) {
        // A paged read cannot count its own rows, so it asks. An unpaged read
        // has already read every match and asking again would be a second
        // round trip for a number it is holding.
        const total = limit === undefined ? rows.length : await countProgrammes(where)
        const proseById = prose ? await readProse(where) : null

        return {
          source: 'ibass',
          total,
          programmes: rows.map(({ id, ruleStatus, ...row }) => {
            const detail = proseById?.get(id)

            return {
              ...row,
              programmeId: id,
              ruleStatus: ruleStatus ?? null,
              olevelRequirements: detail?.olevelRequirements,
              directEntryRequirements: detail?.directEntryRequirements,
              remarks: detail?.remarks,
            }
          }),
        }
      }
    } catch (error) {
      console.warn('[catalogue] Could not read IBASS mirror:', error)
    }
  }

  const sample = sampleProgrammes()
  const matched = sample.filter((programme) => sampleMatches(programme, filter))

  return { source: 'sample', programmes: samplePage(matched), total: matched.length }
}

/**
 * The brochure prose for a read that renders it, keyed by programme id.
 *
 * A second query rather than three more columns on the listing read, so that a
 * read which never shows the prose never transfers it. It is the same table, the
 * same join and — via `programmeFilter` — the same filter as `readProgrammes`,
 * which is what stops the two disagreeing about which programmes exist.
 *
 * The filter is a parameter rather than a name because a whole-catalogue prose
 * read is the single most expensive query in this codebase: the prose is HTML at
 * roughly 15KB a programme. A caller that can narrow must be able to, and this
 * signature is what makes narrowing the easy thing to do rather than the thing
 * you have to remember.
 */
async function readProse(where: SQL | undefined): Promise<Map<string, ProgrammeProse>> {
  const rows = await db!
    .select({ id: catalogueProgrammes.id, ...PROSE_COLUMNS })
    .from(catalogueProgrammes)
    .innerJoin(catalogueInstitutions, eq(catalogueProgrammes.institutionId, catalogueInstitutions.id))
    .where(where)

  return new Map(rows.map((row) => [row.id, row] as const))
}

/**
 * The document Swift indexes. It never silently turns a national catalogue row
 * into an automated decision: that remains limited to reviewed `courses`.
 *
 * `prose` is off by default for the same reason it is off in `readProgrammes`:
 * subject discovery reads this whole document on every search and renders none
 * of the prose, so paying for it there would buy nothing. The knowledge document
 * renders it and asks for it.
 */
export async function listSwiftKnowledgeProgrammes(
  options: { prose?: boolean } = {},
): Promise<{
  programmes: SwiftKnowledgeProgramme[]
  source: 'ibass' | 'sample'
}> {
  return readProgrammes(options)
}

/**
 * A page of programmes, for a caller asking a question rather than rendering the
 * whole catalogue.
 *
 * The API's entry point into `readProgrammes`, and the reason it exists as a
 * separate export is narrow: the reader is private, so a paged caller has no way
 * in, and the API has three. It adds two things the reader does not do for
 * itself — the reviewed-course resolution, which every view of a programme needs
 * and which the by-school view already does through `resolveReviewedCourses`, and
 * nothing else. The paging, the filtering and the sample fallback are the
 * reader's, so there is still one implementation of each.
 */
export async function listProgrammes(options: {
  /** Narrow to one institution by its catalogue id, or by the mirror's slug. */
  institutionId?: string
  /** Narrow to institutions in one state. */
  state?: string
  /** Free text over the programme and institution names. */
  q?: string
  /** A subject code, as `/subjects` publishes them. */
  subject?: SubjectCode
  /** Rows to return. Omit for every match — the API always passes one. */
  limit?: number
  /** Where to start. Ignored without a `limit`. */
  offset?: number
}): Promise<{
  programmes: SwiftKnowledgeProgramme[]
  source: 'ibass' | 'sample'
  /** Matches across every page, not just this one. */
  total: number
}> {
  const [{ programmes, source, total }, { data: courses }] = await Promise.all([
    readProgrammes(options),
    listCourses(),
  ])

  return { programmes: resolveReviewedCourses(programmes, courses), source, total }
}

/**
 * Every institution in the catalogue, with how many programmes it currently
 * lists.
 *
 * Read separately from the programme list because an institution is a thing a
 * student searches by — "which schools are in Lagos?" — and a list of programme
 * rows cannot answer it. An institution with no programmes at all still exists,
 * which is why the join below is a LEFT join: an inner one would hide exactly
 * the schools the mirror knows about but has no programme detail for.
 */
export async function listInstitutions(): Promise<{
  institutions: CatalogueInstitution[]
  source: 'ibass' | 'sample'
}> {
  if (db) {
    try {
      const rows = await db
        .select({
          id: catalogueInstitutions.id,
          name: catalogueInstitutions.name,
          institutionType: catalogueInstitutions.institutionType,
          category: catalogueInstitutions.category,
          state: catalogueInstitutions.state,
          sourceUrl: catalogueInstitutions.sourceUrl,
          sourceUpdatedAt: catalogueInstitutions.sourceUpdatedAt,
          programmeCount: count(catalogueProgrammes.id),
        })
        .from(catalogueInstitutions)
        .leftJoin(
          catalogueProgrammes,
          eq(catalogueProgrammes.institutionId, catalogueInstitutions.id),
        )
        .groupBy(catalogueInstitutions.id)
        // NULL states sort last under ASC, so unrecorded ones land at the end
        // rather than in front of Lagos.
        .orderBy(asc(catalogueInstitutions.state), asc(catalogueInstitutions.name))

      if (rows.length) return { institutions: rows, source: 'ibass' }
    } catch (error) {
      console.warn('[catalogue] Could not read IBASS institutions:', error)
    }
  }

  return { source: 'sample', institutions: sampleInstitutions(sampleProgrammes()) }
}

/**
 * The programmes the catalogue lists under one institution.
 *
 * Matched on the institution's name rather than its id: only a mirrored row
 * carries JAMB's identifier, so a sample row we wrote ourselves would be
 * unreachable by id and the offline path would show every school as empty. Names
 * in the brochure are the institution's own and distinguish branches, so this
 * holds on both paths. The match is applied in SQL by `readProgrammes`, not by
 * filtering a whole-catalogue read in memory.
 *
 * Reviewed courses are resolved here the same way the subject search resolves
 * them, via the shared index, so a programme offers a link into the checker in
 * both views or in neither.
 */
export async function listProgrammesForInstitution(institutionName: string): Promise<{
  programmes: SwiftKnowledgeProgramme[]
  source: 'ibass' | 'sample'
}> {
  const [{ programmes, source }, { data: courses }] = await Promise.all([
    readProgrammes({ institutionName }),
    listCourses(),
  ])

  return { source, programmes: resolveReviewedCourses(programmes, courses) }
}

/**
 * Attach the reviewed course behind each catalogue row.
 *
 * Pure, and shared by the by-school view and the API, so a programme offers a
 * link into the checker in both or in neither — the argument
 * `reviewedCourseIndex` already makes for sharing the *index*. Exported because
 * the API reads its rows paged and so cannot call `listProgrammesForInstitution`,
 * which reads a school whole; without this the API would resolve reviewed courses
 * its own way and could disagree with the app about which programmes a student
 * can actually check.
 *
 * A row that already carries a `reviewedCourseId` keeps it: sample rows are built
 * from the reviewed courses themselves, so their id is a fact rather than a match.
 */
export function resolveReviewedCourses(
  programmes: SwiftKnowledgeProgramme[],
  courses: Course[],
): SwiftKnowledgeProgramme[] {
  const reviewed = reviewedCourseIndex(courses)

  return programmes.map((programme) => ({
    ...programme,
    reviewedCourseId:
      programme.reviewedCourseId ??
      reviewed.get(`${nameKey(programme.institution)}|${nameKey(programme.programme)}`) ??
      null,
  }))
}

/**
 * How large the catalogue is, and how fresh — for `/meta`.
 *
 * Counted in SQL rather than by reading rows: the answer is two integers and a
 * timestamp, and the national mirror is past twenty thousand programmes, so
 * reading them to count them would make the cheapest endpoint in the API the most
 * expensive one to serve.
 *
 * `lastUpdatedAt` is the newest `source_updated_at` in the mirror, which is when
 * the import ran rather than when anybody last asked. Null on the sample path,
 * where the rows are constants and have no crawl date at all.
 */
export async function catalogueStats(): Promise<{
  institutions: number
  programmes: number
  lastUpdatedAt: Date | null
  source: 'ibass' | 'sample'
}> {
  if (db) {
    try {
      const [[institutions], [programmes], [latest]] = await Promise.all([
        db.select({ value: count() }).from(catalogueInstitutions),
        db.select({ value: count() }).from(catalogueProgrammes),
        db.select({ value: max(catalogueProgrammes.sourceUpdatedAt) }).from(catalogueProgrammes),
      ])

      return {
        institutions: institutions?.value ?? 0,
        programmes: programmes?.value ?? 0,
        lastUpdatedAt: latest?.value ? new Date(latest.value) : null,
        source: 'ibass',
      }
    } catch (error) {
      console.warn('[catalogue] Could not count the IBASS mirror:', error)
    }
  }

  const sample = sampleProgrammes()

  return {
    institutions: sampleInstitutions(sample).length,
    programmes: sample.length,
    lastUpdatedAt: null,
    source: 'sample',
  }
}

/* -------------------------------------------------------------------------- */
/* One institution, one programme                                              */
/*                                                                             */
/* Both are read here rather than by filtering `listInstitutions` or           */
/* `readProgrammes` in memory. The API asks for one record by an id it was     */
/* handed, and answering that by reading the whole catalogue and searching it  */
/* is the mistake `readProgrammes` already carries a warning about — except    */
/* that here the caller is a stranger, so the cost is theirs to spend and ours */
/* to pay.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One institution, by JAMB's id for it or by the name IBASS publishes.
 *
 * Both keys are accepted because callers arrive holding different ones. A
 * client following a link from a programme is holding the id; a client built by
 * hand from the docs is more likely to be holding the name, which is what a
 * person types and what the brochure prints. Ids are tried first only because
 * they are the exact key — a name is a convenience, and a name that happens to
 * read like an id should not shadow one.
 *
 * An institution the catalogue holds no programmes for is still an institution:
 * the join is LEFT, so a school the mirror knows about but has no programme
 * detail for is found and reported with a count of `0` rather than as missing.
 */
export async function findInstitution(idOrName: string): Promise<{
  institution: CatalogueInstitution | null
  source: 'ibass' | 'sample'
}> {
  if (db) {
    try {
      const rows = await db
        .select({
          id: catalogueInstitutions.id,
          name: catalogueInstitutions.name,
          institutionType: catalogueInstitutions.institutionType,
          category: catalogueInstitutions.category,
          state: catalogueInstitutions.state,
          sourceUrl: catalogueInstitutions.sourceUrl,
          sourceUpdatedAt: catalogueInstitutions.sourceUpdatedAt,
          programmeCount: count(catalogueProgrammes.id),
        })
        .from(catalogueInstitutions)
        .leftJoin(
          catalogueProgrammes,
          eq(catalogueProgrammes.institutionId, catalogueInstitutions.id),
        )
        .where(
          or(
            eq(catalogueInstitutions.id, idOrName),
            eq(catalogueInstitutions.name, idOrName),
          ),
        )
        .groupBy(catalogueInstitutions.id)
        .limit(1)

      // An empty result is a real answer, not a reason to fall back: the mirror
      // was asked and does not hold this school. Substituting a sample row here
      // would answer a question about the national catalogue with a constant.
      return { institution: rows[0] ?? null, source: 'ibass' }
    } catch (error) {
      console.warn('[catalogue] Could not read one IBASS institution:', error)
    }
  }

  const institution = sampleInstitutions(sampleProgrammes()).find(
    (row) => row.id === idOrName || row.name === idOrName,
  )

  return { source: 'sample', institution: institution ?? null }
}

/**
 * One programme, with its full requirement prose.
 *
 * The one read in this module that renders the prose rather than only listing
 * the row, which is what a detail lookup is *for* — `PROSE_COLUMNS` explains why
 * that is a flag rather than the default everywhere.
 *
 * A paged listing deliberately does not carry the prose. A client that needs it
 * fetches the programme it is about to quote; a client rendering thirty search
 * results does not, and handing it fifteen kilobytes of HTML per row to discard
 * is how a search endpoint becomes a slow one.
 */
export async function findProgrammeById(ref: string): Promise<{
  programme: SwiftKnowledgeProgramme | null
  source: 'ibass' | 'sample'
}> {
  const fromConstants = () =>
    sampleProgrammes().find((programme) => programmeRef(programme) === ref) ?? null

  // A `sample:` id can only name a constant, so asking the mirror would be a
  // round trip that could not possibly answer — and, on the no-database path,
  // one that fails slowly before reaching the same result.
  if (ref.startsWith(SAMPLE_PROGRAMME_PREFIX)) {
    return { source: 'sample', programme: fromConstants() }
  }

  if (db) {
    try {
      const rows = await db
        .select({ ...LISTING_COLUMNS, ...PROSE_COLUMNS })
        .from(catalogueProgrammes)
        .innerJoin(
          catalogueInstitutions,
          eq(catalogueProgrammes.institutionId, catalogueInstitutions.id),
        )
        .leftJoin(programmeRules, eq(programmeRules.programmeId, catalogueProgrammes.id))
        .where(eq(catalogueProgrammes.id, ref))
        .limit(1)

      const row = rows[0]
      if (!row) return { source: 'ibass', programme: null }

      const { id, ruleStatus, ...rest } = row

      return {
        source: 'ibass',
        programme: { ...rest, programmeId: id, ruleStatus: ruleStatus ?? null },
      }
    } catch (error) {
      console.warn('[catalogue] Could not read one IBASS programme:', error)
    }
  }

  return { source: 'sample', programme: fromConstants() }
}
