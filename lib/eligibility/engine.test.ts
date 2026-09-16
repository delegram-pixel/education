import { describe, expect, it } from 'vitest'

import { checkEligibility, normaliseResults } from '@/lib/eligibility/engine'
import { getCourse } from '@/lib/db/courses.data'
import { isCredit, resultSetSchema, type Grade, type OLevelResult, type SubjectCode } from '@/lib/types'

const medicine = getCourse('medicine-unilag')!
const computerScience = getCourse('computer-science-unilag')!
const accounting = getCourse('accounting-unilag')!

/** Terse result builder: r({ ENG: 'B2', MTH: 'C4' }) */
function r(map: Partial<Record<SubjectCode, Grade>>, sitting: 1 | 2 = 1): OLevelResult[] {
  return Object.entries(map).map(([subject, grade]) => ({
    subject: subject as SubjectCode,
    grade: grade as Grade,
    sitting,
  }))
}

describe('grade model', () => {
  it('treats A1 through C6 as credits', () => {
    for (const g of ['A1', 'B2', 'B3', 'C4', 'C5', 'C6'] as Grade[]) {
      expect(isCredit(g), g).toBe(true)
    }
  })

  it('treats D7 and E8 as passes but NOT credits', () => {
    // The single most common bug in eligibility checkers. Locked down here.
    expect(isCredit('D7')).toBe(false)
    expect(isCredit('E8')).toBe(false)
    expect(isCredit('F9')).toBe(false)
  })
})

describe('normaliseResults', () => {
  it('keeps the best grade when a subject is taken in both sittings', () => {
    const best = normaliseResults([
      ...r({ PHY: 'D7' }, 1),
      ...r({ PHY: 'C4' }, 2),
    ])
    expect(best.get('PHY')?.grade).toBe('C4')
  })

  it('is order-independent', () => {
    const forwards = normaliseResults([...r({ PHY: 'D7' }, 1), ...r({ PHY: 'B3' }, 2)])
    const backwards = normaliseResults([...r({ PHY: 'B3' }, 2), ...r({ PHY: 'D7' }, 1)])
    expect(forwards.get('PHY')?.grade).toBe(backwards.get('PHY')?.grade)
  })
})

describe('checkEligibility — Medicine (five mandatory subjects, no groups)', () => {
  it('passes a student with credits in every required subject', () => {
    const v = checkEligibility(
      medicine,
      r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2', PHY: 'C4' }),
    )

    expect(v.status).toBe('eligible')
    expect(v.creditCount).toBe(5)
    expect(v.missing).toHaveLength(0)
    expect(v.blockers).toBe(0)
    expect(v.satisfied).toHaveLength(5)
  })

  it('flags a D7 in a mandatory subject as below_credit, not absent', () => {
    const v = checkEligibility(
      medicine,
      r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2', PHY: 'D7' }),
    )

    expect(v.status).toBe('partial')
    expect(v.missing).toEqual([{ subject: 'PHY', reason: 'below_credit', grade: 'D7' }])
    expect(v.explanation).toContain('Physics')
    expect(v.explanation).toContain('D7')
  })

  it('flags an entirely absent mandatory subject as absent', () => {
    const v = checkEligibility(
      medicine,
      r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2', ECO: 'C4' }),
    )

    expect(v.missing).toEqual([{ subject: 'PHY', reason: 'absent' }])
    expect(v.missing[0]).not.toHaveProperty('grade')
  })

  it('counts two failed mandatory subjects as not_eligible', () => {
    const v = checkEligibility(
      medicine,
      r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'F9', PHY: 'D7' }),
    )

    expect(v.status).toBe('not_eligible')
    expect(v.blockers).toBe(2)
    expect(v.missing.map((m) => m.subject).sort()).toEqual(['CHM', 'PHY'])
  })

  it('does not double-count one missing subject as two blockers', () => {
    // Missing Physics is both a named deficiency AND the reason the credit count
    // sits at four. That is one problem, one re-sit, and must read as 'partial'.
    const v = checkEligibility(medicine, r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2' }))

    expect(v.creditCount).toBe(4)
    expect(v.shortfall).toBe(1)
    expect(v.blockers).toBe(1)
    expect(v.status).toBe('partial')
  })

  it('rescues a first-sitting failure with a second-sitting credit', () => {
    const v = checkEligibility(medicine, [
      ...r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2', PHY: 'F9' }, 1),
      ...r({ PHY: 'C5' }, 2),
    ])

    expect(v.status).toBe('eligible')
    expect(v.sittingsUsed).toBe(2)
  })
})

describe('checkEligibility — Computer Science (mandatory + an anyOf group)', () => {
  it('is satisfied by exactly the minimum number of group subjects', () => {
    const v = checkEligibility(
      computerScience,
      r({ ENG: 'B2', MTH: 'A1', PHY: 'B3', CHM: 'C5', FMA: 'C6' }),
    )

    expect(v.status).toBe('eligible')
    expect(v.unmetGroups).toHaveLength(0)
  })

  it('reports a group deficit when only one of the two group subjects is a credit', () => {
    const v = checkEligibility(
      computerScience,
      r({ ENG: 'B2', MTH: 'A1', PHY: 'B3', CHM: 'C5', FMA: 'D7' }),
    )

    expect(v.status).toBe('partial')
    expect(v.unmetGroups).toHaveLength(1)
    expect(v.unmetGroups[0]).toMatchObject({ need: 2, have: 1 })
    expect(v.explanation).toContain('science or quantitative subjects')
  })

  it('never lets a mandatory subject also satisfy its own anyOf group', () => {
    // Physics is mandatory here and also appears in no group; Chemistry is in
    // the group only. A student with Physics + Chemistry has one group credit,
    // not two.
    const v = checkEligibility(computerScience, r({ ENG: 'B2', MTH: 'A1', PHY: 'B3', CHM: 'C5' }))

    expect(v.unmetGroups[0]).toMatchObject({ need: 2, have: 1 })
    expect(v.unmetGroups[0]?.subjects).not.toContain('PHY')
  })
})

describe('checkEligibility — Accounting', () => {
  it('accepts arts subjects toward the commercial group', () => {
    const v = checkEligibility(
      accounting,
      r({ ENG: 'B2', MTH: 'C4', ECO: 'B3', GOV: 'C5', LIT: 'C6' }),
    )
    expect(v.status).toBe('eligible')
  })

  it('does not count a science subject outside the group', () => {
    const v = checkEligibility(
      accounting,
      r({ ENG: 'B2', MTH: 'C4', ECO: 'B3', PHY: 'A1', CHM: 'A1' }),
    )
    expect(v.status).toBe('not_eligible')
    expect(v.unmetGroups[0]).toMatchObject({ need: 2, have: 0 })
  })
})

describe('verdict language', () => {
  it('never phrases an ineligible result as a dead end', () => {
    const v = checkEligibility(medicine, r({ ENG: 'D7', MTH: 'E8', BIO: 'F9', CHM: 'F9', PHY: 'F9' }))

    expect(v.status).toBe('not_eligible')
    expect(v.nextSteps.length).toBeGreaterThan(0)
    expect(v.explanation).not.toMatch(/cannot|impossible|fail/i)
  })

  it('tells a partial student that their existing passes still count', () => {
    const v = checkEligibility(medicine, r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2', PHY: 'D7' }))
    expect(v.nextSteps.join(' ')).toContain('nothing you have passed is wasted')
  })

  it('gives an eligible student their UTME subject combination', () => {
    const v = checkEligibility(medicine, r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2', PHY: 'C4' }))
    expect(v.nextSteps[0]).toContain('Biology')
    expect(v.nextSteps.join(' ')).toContain(String(medicine.utmeCutoff))
  })
})

describe('resultSetSchema', () => {
  it('rejects the same subject entered twice in one sitting', () => {
    const parsed = resultSetSchema.safeParse([
      ...r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2' }),
      { subject: 'BIO', grade: 'C4', sitting: 1 },
    ])

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes('already entered'))).toBe(true)
    }
  })

  it('allows the same subject across two different sittings', () => {
    const parsed = resultSetSchema.safeParse([
      ...r({ ENG: 'B2', MTH: 'B3', BIO: 'A1', CHM: 'B2', PHY: 'F9' }, 1),
      ...r({ PHY: 'C4' }, 2),
    ])
    expect(parsed.success).toBe(true)
  })

  it('requires English and Mathematics', () => {
    const parsed = resultSetSchema.safeParse(r({ BIO: 'A1', CHM: 'B2', PHY: 'C4', ECO: 'C4', GOV: 'C5' }))
    expect(parsed.success).toBe(false)
  })
})
