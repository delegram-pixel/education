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
 * The API key is public by design. It ships in the page source and is sent as
 * the `X-API-Key` header, which is why NEXT_PUBLIC_ is correct here. This is the
 * one place in this application where a key belongs in client code; nothing
 * server-side should ever be put in these attributes.
 *
 * When the credentials are absent the widget is simply not rendered and the app
 * continues to work. Every contextual trigger degrades to a human-support route
 * on its own — see `AskCopilotButton`.
 */
export function SwiftAgentScript() {
  const companyId = process.env.NEXT_PUBLIC_SWIFT_COMPANY_ID
  const apiKey = process.env.NEXT_PUBLIC_SWIFT_API_KEY
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
