/**
 * Delete student rows past their retention window.
 *
 * Run on a schedule (a platform cron job is enough):
 *
 *   yarn data:prune
 *
 * The periods live in `lib/retention.ts` and are repeated to visitors on
 * `/privacy`. A prune that deleted nothing and one that could not reach the
 * database are different outcomes, so this prints both what happened and
 * whether a database was configured at all.
 */

import './env'

import { dbConfigured } from '../lib/db'
import { pruneExpiredData } from '../lib/db/queries'
import { RETENTION } from '../lib/retention'

async function main() {
  if (!dbConfigured) {
    console.log('No DATABASE_URL set — there is nothing to prune.')
    return
  }

  console.log(
    `Pruning checks older than ${RETENTION.checksDays} days, ` +
      `quiz results older than ${RETENTION.personaDays} days, ` +
      `tickets older than ${RETENTION.ticketsDays} days.`,
  )

  const counts = await pruneExpiredData()

  console.log(
    `Removed ${counts.checks} eligibility check${counts.checks === 1 ? '' : 's'}, ` +
      `${counts.personas} quiz result${counts.personas === 1 ? '' : 's'} and ` +
      `${counts.tickets} ticket${counts.tickets === 1 ? '' : 's'}.`,
  )
}

main().catch((error) => {
  console.error('Prune failed:', error)
  process.exitCode = 1
})
