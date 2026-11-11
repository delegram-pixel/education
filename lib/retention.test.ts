import { describe, expect, it } from 'vitest'

import { cutoffFor, isExpired, RETENTION } from '@/lib/retention'

const DAY_MS = 24 * 60 * 60 * 1000

describe('retention windows', () => {
  it('expires a check just past the boundary, not inside it', () => {
    const now = new Date('2026-11-11T12:00:00.000Z')
    const justInside = new Date(now.getTime() - RETENTION.checksDays * DAY_MS + 1)
    const exactlyAtBoundary = new Date(now.getTime() - RETENTION.checksDays * DAY_MS)
    const justOutside = new Date(now.getTime() - RETENTION.checksDays * DAY_MS - 1)

    expect(isExpired(justInside, RETENTION.checksDays, now)).toBe(false)
    expect(isExpired(exactlyAtBoundary, RETENTION.checksDays, now)).toBe(false)
    expect(isExpired(justOutside, RETENTION.checksDays, now)).toBe(true)
  })

  it('uses different windows for checks and tickets', () => {
    const now = new Date('2026-11-11T12:00:00.000Z')
    const sixMonthsOld = new Date(now.getTime() - 180 * DAY_MS)

    expect(isExpired(sixMonthsOld, RETENTION.checksDays, now)).toBe(true)
    expect(isExpired(sixMonthsOld, RETENTION.ticketsDays, now)).toBe(false)
  })

  it('computes the cutoff used by the prune job', () => {
    const now = new Date('2026-11-11T12:00:00.000Z')
    expect(cutoffFor(1, now).toISOString()).toBe('2026-11-10T12:00:00.000Z')
  })
})
