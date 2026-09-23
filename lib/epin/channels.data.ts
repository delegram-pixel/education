/**
 * Where a JAMB e-PIN can be bought, and what we are willing to claim about it.
 *
 * READ THIS BEFORE EDITING ANY VALUE BELOW. Every entry here is a fact about
 * somebody else's business: JAMB sets the price and the shortcode, and the
 * vending channels set their own prices and change their own URLs between
 * admission cycles. Nothing in this file has been checked against JAMB or
 * against either channel directly — the figures come from a third-party
 * summary — so every one of them is `unverified`, and the UI is built so an
 * unverified value cannot be displayed without saying so.
 *
 * WHAT WOULD MAKE ONE OF THESE `verified`: opening the official source, reading
 * the figure there, and replacing the `verification` block with
 * `{ status: 'verified', sourceUrl, checkedOn }` where `checkedOn` is the date
 * you actually looked. Do not upgrade one on the strength of a news article, a
 * forwarded message, or another third-party summary — that is how the current
 * values got here, and it is exactly the standard this file exists to enforce.
 *
 * WHAT IS DELIBERATELY NOT HERE: no API keys, no VTpass credentials, no vending
 * call, no order state, no storage of an e-PIN. This app does not sell anything.
 */

import type { EpinPurchase } from './types'

/** The date the third-party figures below were collected. */
const COLLECTED_ON = '20 September 2026'

const fromSummary = (what: string) => ({
  status: 'unverified' as const,
  note: `Taken from a third-party summary collected on ${COLLECTED_ON}. It has not been checked against JAMB or against the channel itself. Confirm the current ${what} on the official channel before you rely on it or budget against it.`,
})

export const JAMB_EPIN: EpinPurchase = {
  price: {
    amountNaira: 4700,
    verification: fromSummary('price'),
  },

  facts: [
    {
      id: 'profile-code-shortcode',
      label: 'Send your NIN to',
      value: '55019',
      verification: fromSummary('shortcode'),
    },
    {
      id: 'where-pin-is-used',
      label: 'The e-PIN is used at',
      value: 'An accredited CBT centre',
      verification: fromSummary('procedure'),
    },
    {
      id: 'what-the-pin-buys',
      label: 'The e-PIN covers',
      value: 'One UTME or Direct Entry registration',
      verification: fromSummary('procedure'),
    },
  ],

  channels: [
    {
      id: 'jamb',
      name: 'JAMB directly',
      operator: 'The Joint Admissions and Matriculation Board',
      url: 'https://www.jamb.gov.ng/',
      // `'unknown'` rather than `true`: we have not confirmed that this is the
      // page that vends e-PINs, only that it is JAMB's own site. Saying `true`
      // here would be asserting something we have not checked.
      official: 'unknown',
      notes: [
        'The board that runs the exam and sets the price. If any channel is the reference point, it is this one.',
        'Buying here means no third party is involved in your registration at all.',
      ],
    },
    {
      id: 'vtpass',
      name: 'VTpass',
      operator: 'VTpass (a private bill-payment company, not JAMB)',
      url: 'https://www.vtpass.com/jamb',
      // VTpass is a legitimate, widely used vending platform, but whether JAMB
      // names it as an official reseller is not something we have confirmed.
      // The distinction matters to a student deciding who to pay.
      official: 'unknown',
      notes: [
        'A private company that resells the e-PIN. It is not JAMB, and your money goes to VTpass, not to the board.',
        'It advertises no convenience fee on top of the e-PIN price — confirm that on the page before you pay.',
        'You need your profile code before you can buy here.',
      ],
    },
  ],

  neverAsk: [
    'Your e-PIN. It works like cash — whoever holds the code can spend it. We never ask for it, and we never store it, so there is nothing here for anyone to steal.',
    'Your profile code. Anyone who has it can register in your place.',
    'An OTP, your card PIN, or your bank details. No legitimate agent needs these — not us, not a counselor, not JAMB, not the CBT centre.',
    'Payment through a link someone sent you, however official it looks. Open the channel yourself.',
  ],
}
