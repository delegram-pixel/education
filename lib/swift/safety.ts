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

/**
 * The rules that only apply once a student is buying an e-PIN.
 *
 * WHY THESE ARE SEPARATE FROM `SAFETY_POINTS`. That list feeds
 * `AdmissionSafetyNotice`, which renders on every page in the app. These four
 * rules matter enormously on the one screen where a student is about to send
 * money somewhere, and are noise on the eligibility checker — and adding them
 * app-wide would lengthen a notice students already scroll past, which makes the
 * three rules that *do* apply everywhere easier to ignore. Scope is what keeps a
 * warning worth reading.
 *
 * THEY DO NOT JOIN `SAFETY_GUARDRAIL` EITHER, for the reason given above it:
 * that string rides along with every question the app copies, and it has to stay
 * one sentence. The guardrail already covers the OTP and card half of this; the
 * e-PIN-specific half is only true on this one flow.
 */
export const EPIN_SAFETY_POINTS = [
  'Treat the e-PIN like cash. Whoever has the code can spend it, so do not post it, screenshot it into a group chat, or send it to anyone.',
  'Never send your profile code to someone who offers to buy the PIN for you. That is the scam this process attracts most, and it costs you the registration.',
  'Buy only from a channel you opened yourself. Type the address or use the link on this page — never one that arrived by message, however official it looks.',
  'Nobody legitimate asks for your OTP, card PIN or bank details to sell you an e-PIN. Not JAMB, not a CBT centre, not a vending site, not us.',
] as const
