/**
 * The eligibility engine.
 *
 * This module is deliberately pure: it imports nothing from Next, React, or the
 * database, and it performs no I/O. Given a course and a set of O'level results
 * it returns a verdict. That constraint is what makes it unit-testable in
 * isolation, and it is the part of this application most worth trusting.
 *
 * Two rules drive almost everything:
 *   1. Only A1–C6 are credits. D7 and E8 are passes and satisfy nothing.
 *   2. Results may be combined across two sittings, and the *best* grade for a
 *      subject is the one that counts.
 */

import {
  isBetterGrade,
  isCredit,
  listNames,
  listSubjects,
  subjectName,
  type EligibilitySubject,
  type Grade,
  type MissingRequirement,
  type OLevelResult,
  type SubjectCode,
  type UnmetGroup,
  type Verdict,
} from '@/lib/types'

/**
 * Collapse a result set to one entry per subject, keeping the best grade.
 *
 * A student who scored D7 in Physics in their first sitting and C4 in their
 * second is credited with the C4 — that is how combining sittings actually
 * works, and showing them the D7 instead would be both wrong and discouraging.
 */
export function normaliseResults(results: OLevelResult[]): Map<SubjectCode, OLevelResult> {
  const best = new Map<SubjectCode, OLevelResult>()

  for (const result of results) {
    const existing = best.get(result.subject)
    if (!existing || isBetterGrade(result.grade, existing.grade)) {
      best.set(result.subject, result)
    }
  }

  return best
}

export function checkEligibility(subject: EligibilitySubject, results: OLevelResult[]): Verdict {
  const { olevelRule: rule } = subject
  const best = normaliseResults(results)

  const sittingsUsed = new Set(results.map((r) => r.sitting)).size

  const credited = [...best.values()].filter((r) => isCredit(r.grade))
  const creditCount = credited.length

  /* --- Mandatory subjects ------------------------------------------------ */

  const satisfied: { subject: SubjectCode; grade: Grade }[] = []
  const missing: MissingRequirement[] = []

  for (const subject of rule.mandatory) {
    const result = best.get(subject)

    if (!result) {
      missing.push({ subject, reason: 'absent' })
    } else if (!isCredit(result.grade)) {
      missing.push({ subject, reason: 'below_credit', grade: result.grade })
    } else {
      satisfied.push({ subject, grade: result.grade })
    }
  }

  /* --- "Any N of…" groups ------------------------------------------------ */

  const mandatorySet = new Set(rule.mandatory)
  const unmetGroups: UnmetGroup[] = []

  for (const group of rule.anyOf ?? []) {
    // Mandatory subjects are counted once, against the mandatory list. A course
    // asking for "Physics plus any two sciences" must not have Physics satisfy
    // both halves of its own requirement.
    const eligibleSubjects = group.subjects.filter((s) => !mandatorySet.has(s))
    const have = eligibleSubjects.filter((s) => {
      const r = best.get(s)
      return r !== undefined && isCredit(r.grade)
    }).length

    if (have < group.count) {
      unmetGroups.push({
        subjects: eligibleSubjects,
        label: group.label,
        need: group.count,
        have,
      })
    }
  }

  /* --- Counting blockers ------------------------------------------------- */

  const namedBlockers =
    missing.length + unmetGroups.reduce((sum, g) => sum + (g.need - g.have), 0)

  const shortfall = Math.max(0, rule.minCredits - creditCount)

  // A named deficiency and a credit shortfall are usually the same problem seen
  // twice: passing the missing Physics paper both satisfies Physics *and* adds
  // the fifth credit. Taking the maximum counts that once, so a student one
  // re-sit away is told they are one re-sit away.
  const blockers = Math.max(namedBlockers, shortfall)

  const status: Verdict['status'] =
    blockers === 0 ? 'eligible' : blockers === 1 ? 'partial' : 'not_eligible'

  return {
    status,
    creditCount,
    satisfied,
    missing,
    unmetGroups,
    shortfall,
    blockers,
    sittingsUsed,
    explanation: explain(subject, { status, missing, unmetGroups, shortfall, creditCount }),
    nextSteps: buildNextSteps(subject, { status, missing, unmetGroups, shortfall, creditCount }),
  }
}

/* -------------------------------------------------------------------------- */
/* Language                                                                    */
/*                                                                            */
/* Every sentence below is user-facing. The rules are: no jargon, no blame,    */
/* and never a dead end. "You're not eligible yet" is a different sentence     */
/* from "You're not eligible", and the difference matters to a 17-year-old.    */
/* -------------------------------------------------------------------------- */

type VerdictCore = Pick<
  Verdict,
  'status' | 'missing' | 'unmetGroups' | 'shortfall' | 'creditCount'
>

function describeMissing(m: MissingRequirement): string {
  return m.reason === 'below_credit'
    ? `at least a C6 in ${subjectName(m.subject)}`
    : `a credit in ${subjectName(m.subject)}`
}

function explain(subject: EligibilitySubject, v: VerdictCore): string {
  if (v.status === 'eligible') {
    return `You meet every O'level requirement for ${subject.name} at ${subject.institutionShort}.`
  }

  if (v.status === 'partial') {
    const [only] = v.missing
    if (only) {
      return only.reason === 'below_credit'
        ? `You're one subject away — you have a ${only.grade} in ${subjectName(only.subject)}, and this course needs at least a C6.`
        : `You're one subject away — you'll need a credit in ${subjectName(only.subject)}.`
    }

    const [group] = v.unmetGroups
    if (group) {
      return `You're one subject away — you need one more credit from ${group.label}.`
    }

    return `You're one credit short — you have ${v.creditCount}, and this course needs ${v.creditCount + v.shortfall}.`
  }

  if (v.missing.length >= 2) {
    return `You're currently missing credits in ${listSubjects(v.missing.map((m) => m.subject))}, which ${subject.name} requires.`
  }

  if (v.missing.length === 1 && v.missing[0]) {
    return `You'll need ${describeMissing(v.missing[0])}, plus ${v.shortfall} more credit${v.shortfall === 1 ? '' : 's'}, to qualify for this course.`
  }

  return `You have ${v.creditCount} credit${v.creditCount === 1 ? '' : 's'} so far, and this course needs ${v.creditCount + v.shortfall}.`
}

function buildNextSteps(subject: EligibilitySubject, v: VerdictCore): string[] {
  const steps: string[] = []

  if (v.status === 'eligible') {
    const { utmeRule, utmeCutoff, utmeSubjects } = subject

    // Three cases, in descending order of what we actually hold. A reviewed
    // course carries a combination a person wrote; a course read out of the
    // brochure carries the list IBASS publishes for it, verbatim; and only when
    // we hold neither is the student sent to go and look it up.
    //
    // The third case used to be the only one a read course ever got, including
    // the ones whose combination was sitting in the row we had just read the
    // requirement out of. Naming a combination we do not hold would still be
    // inventing the thing a student is most likely to act on — which is why the
    // brochure's list is repeated as the brochure's list, and not dressed up as
    // a rule of ours.
    steps.push(
      utmeRule
        ? `Register for UTME with ${listSubjects([...utmeRule.compulsory, ...utmeRule.chooseFrom.slice(0, utmeRule.choose)])}.`
        : utmeSubjects?.length
          ? `Register for UTME with ${listNames(utmeSubjects)} — the combination IBASS lists for this course.`
          : 'Register for UTME — check this course’s subject combination in IBASS before you choose your subjects.',
    )

    if (utmeCutoff !== undefined) {
      steps.push(
        `Aim for ${utmeCutoff} or above — that was roughly the mark admitted students hit last year.`,
      )
    }

    steps.push(
      `After UTME, apply for ${subject.institutionShort}'s POST-UTME screening. We'll walk you through it.`,
    )
    return steps
  }

  for (const m of v.missing) {
    steps.push(
      m.reason === 'below_credit'
        ? `Re-sit ${subjectName(m.subject)} at the next WAEC or NECO diet — you need a C6 or better.`
        : `Register for ${subjectName(m.subject)} at your next sitting.`,
    )
  }

  for (const g of v.unmetGroups) {
    const need = g.need - g.have
    steps.push(
      `Add ${need} more credit${need === 1 ? '' : 's'} from ${g.label} — for example ${listSubjects(g.subjects.slice(0, 3))}.`,
    )
  }

  if (v.missing.length === 0 && v.unmetGroups.length === 0 && v.shortfall > 0) {
    steps.push(
      `Take ${v.shortfall} more subject${v.shortfall === 1 ? '' : 's'} and pass at credit level.`,
    )
  }

  steps.push(
    'Your two sittings are combined, so a re-sit adds to what you already have — nothing you have passed is wasted.',
  )

  if (v.status === 'not_eligible') {
    steps.push(
      'If this course is your first choice, it may be worth talking through a related one you already qualify for.',
    )
  }

  return steps
}
