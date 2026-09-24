/**
 * Read a school's programmes out of the brochure, and say what happened to each.
 *
 * The rule reader is deliberately invisible when it works and nearly invisible
 * when it does not: a failed read is never stored, so the student sees the same
 * "we have not reviewed this" panel whether the brochure had nothing to say, the
 * provider rate-limited us, or our own validator threw the reading away. That is
 * the right thing to show a student and an impossible thing to debug — the only
 * way to find out which courses fail is to pick them one at a time in a browser
 * and watch, which costs a model call per guess and, when the call succeeds,
 * tells you nothing at all.
 *
 * This is the other half of that decision. It runs the same `readRule` the app
 * runs, over a whole school, and prints a line per programme:
 *
 *   yarn rules:read "Rivers State University"
 *   yarn rules:read "University of Lagos" --report
 *   yarn rules:read "University of Lagos" --limit 100
 *
 * WHAT IT IS FOR, CONCRETELY:
 *
 *   - Warming the courses you are about to demo. A student picking a course
 *     nobody has read waits seconds for the model; once this has run, they get
 *     the verdict instantly. Read once, stored forever, for everyone after.
 *   - Finding out what is actually broken. Every failure prints its reason and
 *     the summary counts them, so "some courses do not work" becomes a named
 *     list with a cause on each line.
 *
 * IT DOES NOT RE-READ. Programmes that already have a row in `programme_rules`
 * are reported and skipped, because a rule is read at most once ever — so
 * re-running this costs nothing and changes nothing. `--report` reads nothing
 * at all and is safe to run against a database in any state.
 *
 * The limit exists because reading a large school is one model call per
 * programme, pace-limited by the provider. It is a ceiling on this run, not a
 * statement about the school; anything left over is named at the end so it is a
 * known gap rather than a surprise during a demo.
 */

// First, and it has to be: this must run before `lib/db` is loaded, and esbuild
// hoists every import above the rest of the module. See `scripts/env.ts`.
import './env'

import { asc, eq, ilike, inArray } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'

import { db as sharedClient } from '../lib/db'
import { readRule } from '../lib/db/rules'
import * as schema from '../lib/db/schema'

/**
 * The tables, bound by name.
 *
 * The namespace import stays because it is also the client's type parameter —
 * `NeonHttpDatabase<typeof schema>` below — so destructuring keeps both uses on
 * one import rather than importing the same module twice.
 */
const { catalogueInstitutions, catalogueProgrammes, programmeRules } = schema

/** Programmes read in one run unless `--limit` says otherwise. */
const DEFAULT_LIMIT = 30

type Client = NeonHttpDatabase<typeof schema>

type Institution = { id: string; name: string }

/** One line of the report: what happened, to which programme. */
type Line = { label: 'READ' | 'NONE' | 'SKIP' | 'FAIL'; name: string; note: string }

const USAGE = `
Read a school's programmes out of the IBASS brochure and report what happened.

  yarn rules:read <school> [<school>...] [--limit N] [--report]

  <school>     Part of an institution's name, as the catalogue spells it. A term
               that matches several schools lists them rather than guessing.
  --limit N    How many unread programmes to read this run (default ${DEFAULT_LIMIT}).
  --report     Read nothing. Print what is already stored.
`

async function main() {
  const { schools, limit, reportOnly } = parseArgs(process.argv.slice(2))

  if (!schools.length) {
    console.log(USAGE.trim())
    return
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('No DATABASE_URL set — there is no catalogue to read from.')
    return
  }

  // `lib/db` builds its client when it is first imported, which is why
  // `import './env'` has to be the first import above. If that ordering ever
  // stops holding, every read below would come back 'no-database' and read as a
  // catalogue full of broken courses rather than as one unset variable — so it
  // is checked rather than assumed. This guard fired the first time the script
  // was run, which is the whole argument for it existing.
  if (!sharedClient) {
    console.error('The database client was created before .env.local was read. This is a bug in this script.')
    process.exit(1)
  }

  // Named before the first call rather than discovered one at a time. Without a
  // key every programme would come back 'no-key', which reads as a hundred
  // broken courses and is really one unset variable.
  if (!reportOnly && !process.env.GROQ_API_KEY) {
    console.log('No GROQ_API_KEY set — the reader is off, so there is nothing to read.')
    console.log('Set it in .env.local and run this again.')
    return
  }

  const db = drizzle(neon(url), { schema })

  let failed = 0

  for (const school of schools) {
    const matches = await db
      .select({ id: catalogueInstitutions.id, name: catalogueInstitutions.name })
      .from(catalogueInstitutions)
      .where(ilike(catalogueInstitutions.name, `%${school}%`))
      .orderBy(asc(catalogueInstitutions.name))

    if (!matches.length) {
      console.log(`\nNo institution matches "${school}". Try \`yarn catalogue:status\`.`)
      continue
    }

    // Guessing which of eleven schools was meant is how an hour disappears, and
    // the wrong school costs one model call per programme to discover.
    if (matches.length > 1) {
      console.log(`\n"${school}" matches ${matches.length} institutions — name one of them exactly:`)
      for (const match of matches.slice(0, 20)) console.log(`  ${match.name}`)
      if (matches.length > 20) console.log(`  ...and ${matches.length - 20} more`)
      continue
    }

    failed += await reportSchool(db, matches[0]!, { limit, reportOnly })
  }

  if (failed) {
    const plural = failed === 1 ? '' : 's'
    console.log(`\n${failed} programme${plural} failed to read. Each one is named above.`)
  }
}

async function reportSchool(
  db: Client,
  institution: Institution,
  options: { limit: number; reportOnly: boolean },
): Promise<number> {
  const programmes = await db
    .select({
      id: catalogueProgrammes.id,
      name: catalogueProgrammes.name,
      department: catalogueProgrammes.department,
    })
    .from(catalogueProgrammes)
    .where(eq(catalogueProgrammes.institutionId, institution.id))
    .orderBy(asc(catalogueProgrammes.name))

  const plural = programmes.length === 1 ? '' : 's'
  console.log(`\n${institution.name} — ${programmes.length} programme${plural}`)

  if (!programmes.length) {
    console.log('  The catalogue holds no programmes for this school.')
    return 0
  }

  // One query for the whole school rather than one per programme. The point of
  // this run is to spend model calls, not database round trips.
  const stored = await db
    .select({ programmeId: programmeRules.programmeId, status: programmeRules.status })
    .from(programmeRules)
    .where(
      inArray(
        programmeRules.programmeId,
        programmes.map((programme) => programme.id),
      ),
    )

  const settled = new Map(stored.map((row) => [row.programmeId, row.status]))

  const unread = programmes.filter((programme) => !settled.has(programme.id))
  const lines: Line[] = []

  for (const programme of programmes) {
    const status = settled.get(programme.id)
    if (status === 'ready') {
      lines.push({ label: 'SKIP', name: label(programme), note: 'already read' })
    } else if (status === 'no-source') {
      lines.push({ label: 'NONE', name: label(programme), note: 'already read — the brochure states no requirement' })
    }
  }

  const attempt = options.reportOnly ? [] : unread.slice(0, Math.max(0, options.limit))

  for (const programme of attempt) {
    const result = await readRule(programme.id)

    if (result.rule?.status === 'ready') {
      lines.push({ label: 'READ', name: label(programme), note: 'rule read' })
    } else if (result.rule?.status === 'no-source') {
      lines.push({ label: 'NONE', name: label(programme), note: 'nothing to read — the brochure states no requirement' })
    } else {
      lines.push({
        label: 'FAIL',
        name: label(programme),
        note: `${result.reason}${result.detail ? ` — ${result.detail}` : ''}`,
      })
    }
  }

  for (const line of lines) {
    console.log(`  ${line.label.padEnd(5)} ${line.name.padEnd(46)} ${line.note}`)
  }

  const read = lines.filter((line) => line.label === 'READ').length
  const empty = lines.filter((line) => line.label === 'NONE').length
  const skipped = lines.filter((line) => line.label === 'SKIP').length
  const failures = lines.filter((line) => line.label === 'FAIL')

  console.log(
    `\n  ${programmes.length} listed · ${skipped} already read · ${read} read now · ` +
      `${empty} with nothing to read · ${failures.length} failed`,
  )

  if (failures.length) {
    const byReason = new Map<string, number>()
    for (const failure of failures) {
      const reason = failure.note.split(' —')[0] ?? failure.note
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1)
    }

    console.log('\n  Failures by reason:')
    for (const [reason, total] of [...byReason].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(total).padStart(3)}  ${reason}`)
    }

    console.log('  A failed read is never stored, so these are retried on the next run.')
  }

  const left = unread.length - attempt.length
  if (left > 0) {
    console.log(
      `\n  ${left} unread programme${left === 1 ? '' : 's'} not attempted (--limit ${options.limit}). ` +
        'Raise --limit to read them, or leave them: each is read on demand the first time a ' +
        'student picks it.',
    )
  }

  return failures.length
}

/** A programme as one line: the name, and the department when it has one. */
function label(programme: { name: string; department: string | null }): string {
  return programme.department ? `${programme.name} · ${programme.department}` : programme.name
}

function parseArgs(argv: string[]): { schools: string[]; limit: number; reportOnly: boolean } {
  const schools: string[] = []
  let limit = DEFAULT_LIMIT
  let reportOnly = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!

    if (arg === '--report') {
      reportOnly = true
    } else if (arg === '--limit') {
      const value = Number(argv[index + 1])
      if (Number.isFinite(value) && value >= 0) limit = value
      index += 1
    } else if (arg.startsWith('--')) {
      console.log(`Unknown option ${arg}.`)
      console.log(USAGE.trim())
      process.exit(1)
    } else {
      schools.push(arg)
    }
  }

  return { schools, limit, reportOnly }
}

main().catch((error) => {
  console.error('Could not read the rules:', error)
  process.exit(1)
})
