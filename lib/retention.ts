/**
 * How long student data is kept.
 *
 * These are policy, not implementation detail, so they live in one file and are
 * used by the prune script, the shared-result page and the privacy page. A
 * number that appears in only one of those places is a number that will drift.
 *
 * The two populations are different. An eligibility check is a snapshot of a
 * result slip and only needs to exist long enough for the student to share or
 * revisit it; a ticket is a conversation with a human and needs to survive long
 * enough for support to be useful.
 */
export const RETENTION = {
  /** Eligibility checks, including shared result links. */
  checksDays: 90,
  /** Quiz/persona results. */
  personaDays: 90,
  /** Tickets and their messages. */
  ticketsDays: 365,
  /**
   * A shared result stops resolving after this. It matches the check retention:
   * pruning the row would already turn the link into a 404, and saying so on the
   * page is better than leaving a dead link to look like a bug.
   */
  sharedResultDays: 90,
} as const

const DAY_MS = 24 * 60 * 60 * 1000

export function cutoffFor(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

export function isExpired(createdAt: Date, days: number, now: Date = new Date()): boolean {
  return createdAt.getTime() < cutoffFor(days, now).getTime()
}
