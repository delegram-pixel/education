/**
 * Facts about the outside world, and what we are willing to say about them.
 *
 * WHY THIS IS A TYPE AND NOT A COMMENT. The walkthrough data already carries a
 * hand-written convention — "Anything that is likely to drift is marked
 * `// unverified` on the line it affects" (see `lib/db/walkthroughs.data.ts`).
 * That works for prose. It does not work for a number: a figure gets lifted out
 * of its context by a refactor, a copy edit, or a component that only wanted the
 * value, and nothing complains. Wrapping the value in its verification state
 * means the value cannot travel without it, and a component that renders one has
 * to say out loud which of these three it is looking at.
 *
 * THIS FILE CONTAINS NO PAYMENT CODE, DELIBERATELY. The app does not take money,
 * hold money, or see a card number, and it does not store an e-PIN either — an
 * e-PIN is a bearer instrument, so holding one is holding cash. What lives in
 * `lib/epin/` is guidance about a purchase the student makes themselves, on a
 * channel they opened themselves, with their own card.
 */

/**
 * What we know about an external fact, and how confident we are allowed to be.
 *
 * `withheld` is a first-class outcome, not a gap to be filled in later. The
 * admission cycles move, and for some facts the honest answer is that we are not
 * stating a figure at all.
 */
export type Verification =
  /** Read from the official source ourselves, with the date we read it. */
  | { status: 'verified'; sourceUrl: string; checkedOn: string }
  /** From a third-party summary or general knowledge. Must be shown as unconfirmed. */
  | { status: 'unverified'; note: string }
  /** We are deliberately not saying. The reason is for the next developer, not the student. */
  | { status: 'withheld'; reason: string }

/** A figure we cannot stand behind on our own authority. */
export type Money = {
  amountNaira: number
  verification: Verification
}

/** A claim a student might act on, carrying its own confidence. */
export type ExternalFact = {
  id: string
  label: string
  value: string
  verification: Verification
}

/**
 * Somewhere a student can legitimately buy an e-PIN.
 *
 * `url` is shown to the student as text as well as a link, on purpose — see
 * `PurchaseChannels`. A lookalike domain is the single most common shape of this
 * particular scam, so asking a student to read the address before they trust it
 * is the point, not a nicety.
 */
export type PurchaseChannel = {
  id: string
  name: string
  /** Who the student is actually paying. Named so they can judge it themselves. */
  operator: string
  url: string
  /** Does JAMB itself name this channel? `'unknown'` is a real answer, not a placeholder. */
  official: boolean | 'unknown'
  notes: string[]
}

/** Everything the e-PIN guide needs that we do not control. */
export type EpinPurchase = {
  price: Money
  facts: ExternalFact[]
  channels: PurchaseChannel[]
  /**
   * What this app promises never to ask for. Rendered to the student as a
   * commitment they can hold us to.
   */
  neverAsk: string[]
}
