/**
 * Deadline and scam protection, in one place.
 *
 * The same three rules have to hold in two very different places: the notice a
 * student reads on the page, and the question we hand to Swift. Keeping them in
 * one module is what stops those two drifting apart — a rule quietly dropped
 * from the prompt during a refactor would leave the notice promising something
 * the assistant is no longer told.
 *
 * `SAFETY_GUARDRAIL` is appended to *every* contextual question by
 * `AskCopilotButton`, so this is not a rule authors of new triggers have to
 * remember to restate.
 */

/** The rules, as shown to the student. */
export const SAFETY_POINTS = [
  'Confirm current deadlines, fees and requirements in JAMB IBASS and your institution’s own bulletin.',
  'Do not pay through a link someone forwarded to you; open official portals yourself.',
  'Never share an OTP, password, PIN or bank-card details with a chat agent or counselor.',
] as const

/**
 * The same rules, addressed to the assistant.
 *
 * Deliberately one sentence: it rides along with every question the app copies,
 * and a paragraph would make the student's actual question hard to find at the
 * top of the paste.
 */
export const SAFETY_GUARDRAIL =
  'Before I act on anything: verify the current session, deadlines and fees in official JAMB IBASS and institution sources; never tell me to pay through a forwarded link; and never ask me for an OTP, password, PIN or card details.'
