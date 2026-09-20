import { connection } from 'next/server'
import Script from 'next/script'

/**
 * Mounts the Swift Agents widget once, at the root of the app.
 *
 * Root placement is required, not preferred: the widget owns a fixed host
 * element and a conversation that must survive client-side navigation. Putting
 * it inside a component that remounts on route change would reset the student's
 * conversation every time they moved between the eligibility check and a
 * walkthrough — precisely when they are most likely to be mid-question.
 *
 * `data-trigger=".open-chat"` binds a delegated listener on `document`, so any
 * element with that class opens the chat, including ones rendered later by a
 * route we have not visited yet.
 *
 * THE CREDENTIALS ARE READ PER REQUEST, NOT AT BUILD TIME. They are deliberately
 * not NEXT_PUBLIC_: that prefix inlines a value into the bundle during the build,
 * freezing whatever the build machine happened to have into every prerendered
 * page. On a host that only injects these values at runtime, a static page would
 * bake in nothing and the widget would be silently absent in production. The
 * `connection()` call below is what makes the runtime read real — it opts this
 * route out of static prerendering. Remove it and that bug comes back.
 *
 * BE HONEST ABOUT WHAT THIS DOES NOT BUY: the widget runs in the visitor's
 * browser and authenticates from there, so these values reach the page source
 * either way. Reading them at runtime buys rotation without a rebuild, not
 * secrecy. Restricting the key to our own origin in the Swift dashboard is what
 * actually limits what it can be used for.
 *
 * When the credentials are absent the widget is simply not rendered and the app
 * continues to work. Every contextual trigger degrades to a human-support route
 * on its own — see `AskCopilotButton`.
 */
export async function SwiftAgentScript() {
  // Without this, a statically prerendered route resolves the values below at
  // build time and the widget never reaches the page in production.
  await connection()

  const companyId = process.env.SWIFT_COMPANY_ID
  const apiKey = process.env.SWIFT_API_KEY
  const hasRealCredentials =
    companyId &&
    apiKey &&
    !companyId.startsWith('your_') &&
    !apiKey.startsWith('your_')

  if (!hasRealCredentials) return null

  return (
    <Script
      src="https://widget.swiftagents.org/dist/widget-ui.js"
      data-company-id={companyId}
      data-api-key={apiKey}
      data-mode="widget"
      data-trigger=".open-chat"
      strategy="afterInteractive"
    />
  )
}
