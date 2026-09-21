/**
 * Guided walkthroughs — sample data.
 *
 * SCOPE NOTE: three walkthroughs. Two match what a UNILAG applicant has to sit
 * down and do — register for the UTME with JAMB, then apply for the university's
 * own POST-UTME screening. The third covers buying the JAMB e-PIN itself, which
 * is the part of the process that money changes hands in and the part that scams
 * cluster around.
 *
 * DATA NOTE: the steps below follow the widely published shape of both
 * processes. Screens, shortcodes, payment channels and the order of a few
 * screens change between admission cycles, and nothing here has been checked
 * against the current JAMB bulletin or the current UNILAG portal. Anything that
 * is likely to drift is marked `// unverified` on the line it affects.
 *
 * DELIBERATE OMISSIONS: no fee amounts, no deadline dates, no portal addresses.
 * A student may act on this file a year after it was written, and a wrong
 * figure or a stale link does more damage than no figure at all. The copy
 * points at what is on screen instead.
 *
 * THE ONE EXCEPTION, AND WHY IT IS SAFE: the e-PIN walkthrough does state a
 * price and does link out. It has to — "open the official channel yourself" is
 * the entire instruction, and a student about to spend money needs an anchor to
 * budget against. So that walkthrough carries its price, its shortcode and its
 * channels as `EpinPurchase` values from `lib/epin/`, where each one travels
 * with a `Verification` state that the UI is required to render. The rule above
 * is not suspended there; it is enforced by the type instead of by hand, which
 * is the stronger version. See `lib/epin/types.ts`.
 *
 * The `screenshotUrl` paths are referenced ahead of the images themselves; the
 * files under /public/guides are produced separately.
 */

import type { Walkthrough } from '@/lib/types'
import { JAMB_EPIN } from '@/lib/epin/channels.data'

export const WALKTHROUGHS: Walkthrough[] = [
  {
    id: 'jamb',
    title: 'Registering for JAMB',
    description:
      'From creating your profile to printing the slip you take into the exam hall. Part of this is done online and part of it must be done in person.',
    estimatedMinutes: 60,
    bringWithYou: [
      'Your NIN slip, or the phone number your NIN is registered to',
      'A phone you can receive text messages on today',
      'An email address you can open and read',
      'A recent passport photograph on a plain background', // unverified — many centres capture the photograph on the spot instead
      'Money for the fee shown on the portal',
    ],
    steps: [
      {
        id: 'jamb-create-profile',
        order: 1,
        title: 'Create your JAMB profile',
        instruction:
          'Fill in your name, date of birth, phone number and email address exactly as they appear on your NIN slip.',
        screenshotUrl: '/guides/jamb/1.png',
        hotspot: { x: 8, y: 34, w: 46, h: 9 },
        tip: 'Use the name exactly as it is on your NIN, in the same order and the same spelling. If it does not match the name on your school documents, correct the NIN record first, before you go any further.',
        defines: [
          {
            term: 'UTME',
            meaning:
              'Unified Tertiary Matriculation Examination. The exam JAMB runs once a year, which nearly every Nigerian university uses to rank applicants.',
          },
          {
            term: 'NIN',
            meaning:
              'National Identification Number. The 11-digit number on the slip you were given when you enrolled with NIMC.',
          },
        ],
      },
      {
        id: 'jamb-validate-nin',
        order: 2,
        title: 'Send your NIN by text message',
        instruction:
          'Send your NIN as a text message to the shortcode shown on the screen, using the same phone number you just entered.',
        screenshotUrl: '/guides/jamb/2.svg',
        hotspot: { x: 28, y: 40, w: 44, h: 13 }, // the shortcode panel, not a button
        tip: null,
      },
      {
        id: 'jamb-profile-code',
        order: 3,
        title: 'Wait for your profile code',
        instruction:
          'Check your phone for the reply from JAMB and write the profile code down somewhere you will still have it in a month.',
        screenshotUrl: '/guides/jamb/3.png',
        hotspot: null, // nothing to press here — the code arrives on the phone
        tip: 'If no message has arrived after a while, check that the phone has network, make sure you sent the text from the same number you entered, and send it again. The reply does not always come back immediately.',
        defines: [
          {
            term: 'profile code',
            meaning:
              'A short code JAMB sends you by text once your NIN has been accepted. You will be asked for it at every later stage, so keep it.',
          },
        ],
      },
      {
        id: 'jamb-choose-centre',
        order: 4,
        title: 'Choose a CBT centre',
        instruction:
          'Pick an approved CBT centre close to where you will actually be staying on exam day.',
        screenshotUrl: '/guides/jamb/4.png',
        hotspot: { x: 9, y: 31, w: 52, h: 24 },
        tip: 'The centre you pick here is where you must sit the exam, and exam sittings often start very early. Do not choose a centre in a town you cannot reach in the morning, even if it is the one your friends chose.',
        defines: [
          {
            term: 'CBT',
            meaning:
              'Computer-Based Test. You answer the questions on a computer at a centre JAMB has approved, not on paper.',
          },
        ],
      },
      {
        id: 'jamb-pay-fee',
        order: 5,
        title: 'Pay the registration fee',
        instruction:
          'Pay the amount shown on the screen and keep the receipt or transaction reference.', // unverified — accepted payment channels differ by year and by centre
        screenshotUrl: '/guides/jamb/5.png',
        hotspot: { x: 62, y: 76, w: 26, h: 9 },
        tip: null,
      },
      {
        id: 'jamb-biometrics',
        order: 6,
        title: 'Have your fingerprints and photograph taken',
        instruction:
          'Go to the CBT centre in person with your profile code so your fingerprints and photograph can be captured.',
        screenshotUrl: '/guides/jamb/6.png',
        hotspot: { x: 54, y: 67, w: 32, h: 11 },
        tip: null,
      },
      {
        id: 'jamb-subjects',
        order: 7,
        title: 'Enter your subject combination',
        instruction:
          'Choose English Language plus the three other subjects your course requires.',
        screenshotUrl: '/guides/jamb/7.png',
        hotspot: { x: 12, y: 26, w: 44, h: 34 },
        tip: 'These four subjects must match what your course asks for. A subject the course does not accept can cost you the place even with a high score, and this is not easy to change afterwards.',
      },
      {
        id: 'jamb-choices',
        order: 8,
        title: 'Enter your institution and course choices',
        instruction:
          'Enter the university and course you want most as your first choice, then fill in the remaining choices.',
        screenshotUrl: '/guides/jamb/8.png',
        hotspot: { x: 11, y: 22, w: 50, h: 12 },
        tip: null,
      },
      {
        id: 'jamb-print-slip',
        order: 9,
        title: 'Print your registration slip',
        instruction:
          'Print the registration slip and make at least one spare copy before you leave the centre.',
        screenshotUrl: '/guides/jamb/9.png',
        hotspot: { x: 68, y: 11, w: 24, h: 8 },
        tip: null,
      },
    ],
  },
  {
    id: 'unilag-postutme',
    title: 'Applying for UNILAG screening',
    description:
      'What to do after your UTME result is out, if UNILAG was one of your choices. This one is entirely online.',
    estimatedMinutes: 30,
    bringWithYou: [
      'Your JAMB registration number and your registration slip',
      "Your O'level result slip, with the grade for every subject",
      'A phone number and email address you can reach today',
      'A passport photograph saved on the device you are using', // unverified — upload requirements change between cycles
      'Money for the fee shown on the portal',
    ],
    steps: [
      {
        id: 'unilag-open-portal',
        order: 1,
        title: 'Open the university admissions portal',
        // No address given on purpose — the portal moves between admission cycles.
        instruction:
          "Open the university's official admissions portal in a browser and find the POST-UTME screening section.",
        screenshotUrl: '/guides/unilag-postutme/1.png',
        hotspot: { x: 56, y: 6, w: 20, h: 7 },
        tip: "Type the address yourself from the university's own website rather than following a link someone forwarded to you. Fake admission portals that take payments appear every year.",
        defines: [
          {
            term: 'POST-UTME',
            meaning:
              'The screening a university runs itself after JAMB releases UTME scores, to choose between the applicants who picked it.', // unverified — the form it takes has changed between cycles
          },
        ],
      },
      {
        id: 'unilag-login',
        order: 2,
        title: 'Log in with your JAMB registration number',
        instruction:
          'Enter your JAMB registration number exactly as it appears on your registration slip.', // unverified — some cycles also ask for a password or a code sent by email
        screenshotUrl: '/guides/unilag-postutme/2.png',
        hotspot: { x: 10, y: 38, w: 42, h: 9 },
        tip: null,
      },
      {
        id: 'unilag-confirm-score',
        order: 3,
        title: 'Check your score and subjects',
        instruction:
          'Read the score and the four subjects on the screen and check that they match your JAMB result slip.',
        screenshotUrl: '/guides/unilag-postutme/3.png',
        hotspot: { x: 8, y: 24, w: 60, h: 22 },
        tip: 'If the score or any subject is wrong here, stop and take it up with JAMB before you pay anything. The university screens you on what JAMB sent, not on what you believe your result was.',
      },
      {
        id: 'unilag-olevel',
        order: 4,
        title: "Enter your O'level results",
        instruction:
          'Type in each subject and grade from your result slip, one row at a time.', // unverified — whether a second sitting can be added here varies by cycle
        screenshotUrl: '/guides/unilag-postutme/4.png',
        hotspot: { x: 8, y: 30, w: 66, h: 34 },
        tip: "Enter the grades exactly as they are on the slip, including the weak ones. The university checks what you type against the exam board's own records, and a grade that has been improved on the way in is treated as a false entry.",
        defines: [
          {
            term: "O'level",
            meaning:
              'Your WAEC or NECO result. A credit means C6 or better; D7 and E8 are passes but they do not count as credits.',
          },
        ],
      },
      {
        id: 'unilag-confirm-course',
        order: 5,
        title: 'Confirm the course you are applying for',
        instruction:
          'Check that the course shown is the one you chose on your JAMB form, then confirm it.',
        screenshotUrl: '/guides/unilag-postutme/5.png',
        hotspot: { x: 66, y: 78, w: 24, h: 9 },
        tip: null,
      },
      {
        id: 'unilag-pay-fee',
        order: 6,
        title: 'Pay the screening fee',
        instruction:
          'Pay the amount shown on the screen and wait until the payment is confirmed before you close the page.', // unverified — accepted payment channels differ by year
        screenshotUrl: '/guides/unilag-postutme/6.png',
        hotspot: { x: 63, y: 74, w: 27, h: 10 },
        tip: null,
      },
      {
        id: 'unilag-print-slip',
        order: 7,
        title: 'Print your screening slip',
        instruction:
          'Print the screening slip and save a copy on your phone as well, before the deadline shown on the portal.',
        screenshotUrl: '/guides/unilag-postutme/7.png',
        hotspot: { x: 70, y: 10, w: 22, h: 8 },
        tip: null,
      },
    ],
  },
  {
    id: 'jamb-epin',
    title: 'Buying your JAMB e-PIN',
    description:
      'The e-PIN is the payment you make before you go to a centre, and it is the step where students lose money to people pretending to help. Get your profile code, buy from a channel you opened yourself, and keep the PIN to yourself.',
    estimatedMinutes: 25,
    bringWithYou: [
      'Your NIN slip, or the phone number your NIN is registered to',
      'The profile code JAMB sent you — you need it before you can buy anything',
      'A debit card in your own name, or the means to pay on the official channel',
      'A phone you can receive text messages on, to keep the PIN',
    ],
    steps: [
      {
        id: 'epin-get-profile-code',
        order: 1,
        title: 'Get your profile code, if you do not have one',
        instruction:
          'Send your NIN as a text message to the JAMB shortcode and keep the profile code that comes back. If you already created your profile for this session, skip this step — the code does not change.',
        screenshotUrl: '/guides/jamb-epin/1.png',
        // `hotspot: null` on EVERY step in this walkthrough, deliberately. No
        // real screenshots of these screens exist yet, so `AnnotatedShot` falls
        // back to its illustrative wireframe — and a hotspot rectangle drawn on
        // a generic mock points at nothing. An empty ring is worse than no ring:
        // it tells a student to click a spot that does not mean anything. Add
        // coordinates when real captures land.
        hotspot: null,
        tip: 'Send the text from the phone number you registered with. The reply can take a while, so do this before you are ready to pay rather than in the same minute.',
        defines: [
          {
            term: 'Profile code',
            meaning:
              'The code JAMB sends back after you validate your NIN. It identifies you for this admission session, and it is what the vending channel asks for before it will sell you an e-PIN.',
          },
        ],
      },
      {
        id: 'epin-check-current-terms',
        order: 2,
        title: 'Check the current price and deadline on the official channel',
        instruction:
          'Open the official channel and read the price and the deadline shown there. Do not work from a figure you were told, including the one on this page.',
        screenshotUrl: '/guides/jamb-epin/2.png',
        hotspot: null,
        tip: 'The price on this page is marked unverified on purpose. This is one of the few numbers in the whole process that changes between cycles, and a student who budgets against a stale figure is the one who gets caught short at the centre.',
      },
      {
        id: 'epin-open-channel',
        order: 3,
        title: 'Open the channel yourself',
        instruction:
          'Type the address into your browser, or use one of the links in the panel above this walkthrough. Check the address bar against the address shown next to the link before you enter anything.',
        screenshotUrl: '/guides/jamb-epin/3.png',
        hotspot: null,
        tip: 'This is the step that decides whether the rest of the process is safe. A link that arrived by message, a sponsored search result, or a page a helpful stranger sent you can look identical to the real one and take your card details. Opening it yourself is the whole protection.',
      },
      {
        id: 'epin-buy',
        order: 4,
        title: 'Buy the e-PIN with your own card',
        instruction:
          'Enter your profile code, confirm the amount matches what the channel displayed, and pay. The PIN appears on the screen and is sent to you.',
        screenshotUrl: '/guides/jamb-epin/4.png',
        hotspot: null,
        tip: 'Read the amount on the payment screen before you approve it. If it is higher than the price the channel showed you a moment ago, stop and go back rather than approving it and asking afterwards.',
      },
      {
        id: 'epin-safeguard-pin',
        order: 5,
        title: 'Keep the PIN to yourself',
        instruction:
          'Save the e-PIN somewhere only you can open, and do not send it to anyone — not to a friend, not to a group chat, not to someone who offers to help you register.',
        screenshotUrl: '/guides/jamb-epin/5.png',
        hotspot: null,
        tip: 'The e-PIN works like cash: whoever holds the code can use it to register, and it cannot be un-used. Anyone asking you to send it "so they can check it" or "so they can help you register" is taking your registration, not helping with it.',
        defines: [
          {
            term: 'e-PIN',
            meaning:
              'The electronic PIN you buy to pay for your UTME or Direct Entry registration. It is a code, not a receipt — losing it is the same as losing the money.',
          },
        ],
      },
      {
        id: 'epin-cbt-centre',
        order: 6,
        title: 'Take the PIN and your NIN to an accredited CBT centre',
        instruction:
          'Go to a centre accredited for this session with your e-PIN, your NIN and your profile code. The centre uses the PIN to complete your registration and takes your fingerprints and photograph.',
        screenshotUrl: '/guides/jamb-epin/6.png',
        hotspot: null,
        tip: 'Check the centre is accredited for this session before you travel. The list is published by JAMB each cycle, and a centre that has lost its accreditation cannot register you even though it may still take your PIN.',
        defines: [
          {
            term: 'CBT centre',
            meaning:
              'Computer-Based Test centre. An accredited centre where you sit the UTME and where your registration is completed in person.',
          },
        ],
      },
      {
        id: 'epin-keep-receipt',
        order: 7,
        title: 'Keep the PIN and the receipt until your registration is confirmed',
        instruction:
          'Keep the e-PIN, the payment confirmation and the registration slip together until the centre confirms your registration and you can see your details on the official portal.',
        screenshotUrl: '/guides/jamb-epin/7.png',
        hotspot: null,
        tip: 'If a centre says the PIN did not work, do not buy a second one there and then. Check the PIN on the official channel first — a centre that has already taken one PIN and asks for another is a reason to walk away and report it.',
      },
    ],
    purchase: JAMB_EPIN,
  },
]

export function getWalkthrough(id: string): Walkthrough | undefined {
  return WALKTHROUGHS.find((w) => w.id === id)
}
