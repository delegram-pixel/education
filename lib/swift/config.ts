/**
 * Whether the Swift Agents widget is configured for this deployment.
 *
 * This is a DEPLOYMENT FACT, not a runtime observation. It is answered once on
 * the server and published to the client through `SwiftRuntime`. The client must
 * never try to work this out for itself by watching for a script that may or may
 * not arrive: `AskCopilotButton` used to poll for three seconds and then give up
 * permanently, which turned a slow script into a silent decision that Swift did
 * not exist — and swapped the Swift trigger for a link to the counselor page.
 *
 * SERVER ONLY. Do not import this from a client component. These values are
 * deliberately not NEXT_PUBLIC_, so in the browser they read as `undefined` and
 * this would report the widget missing on a deployment that has it.
 */
export function hasSwiftCredentials(): boolean {
  const companyId = process.env.SWIFT_COMPANY_ID
  const apiKey = process.env.SWIFT_API_KEY

  return Boolean(
    companyId &&
      apiKey &&
      !companyId.startsWith('your_') &&
      !apiKey.startsWith('your_'),
  )
}
