import { describe, expect, it } from 'vitest'

import {
  checkRuleReadAllowance,
  noteRuleReadFailure,
  resetLimitStateForTests,
  ruleReadCoolingDown,
} from '@/lib/action-limits'

describe('rule-read limits', () => {
  it('allows one fresh read of a programme per session window', () => {
    const session = 'test-session-one'

    expect(checkRuleReadAllowance(session, 'school:programme-a').allowed).toBe(true)
    expect(checkRuleReadAllowance(session, 'school:programme-a').allowed).toBe(false)

    // A different programme is still answerable within the hourly allowance.
    expect(checkRuleReadAllowance(session, 'school:programme-b').allowed).toBe(true)
  })

  it('does not apply a session limit when there is no session', () => {
    expect(checkRuleReadAllowance(null, 'school:programme-c').allowed).toBe(true)
    expect(checkRuleReadAllowance(undefined, 'school:programme-c').allowed).toBe(true)
  })

  it('keeps a programme cooling down after a failed read', () => {
    resetLimitStateForTests()
    expect(ruleReadCoolingDown('school:broken')).toBe(false)

    noteRuleReadFailure('school:broken')

    expect(ruleReadCoolingDown('school:broken')).toBe(true)
    expect(ruleReadCoolingDown('school:other')).toBe(false)
  })
})
