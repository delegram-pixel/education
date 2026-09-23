import Script from 'next/script'

/**
 * Render the Swift Agents widget script, or nothing when it is not configured.
 *
 * Mounted once from the root layout via `SwiftRuntime`. That placement is
 * required, not preferred: the widget owns a fixed host element and a
 * conversation that must survive client-side navigation. Putting it inside a
 * component that remounts on route change would reset the student's conversation
 * every time they moved between the eligibility check and a walkthrough —
 * precisely when they are most likely to be mid-question.
 *
 * `data-trigger=".open-chat"` binds a DELEGATED listener on `document`, so any
 * element with that class opens the chat, including ones rendered later by a
 * route we have not visited yet. That delegation is what lets `AskCopilotButton`
 * open the panel with no readiness check at all: a trigger renders as a plain
 * `open-chat` button and starts working whenever the script lands, even if that
 * is ten seconds after first paint. Do not add a gate in front of it.
 *
 * THE CREDENTIALS ARE READ PER REQUEST, NOT AT BUILD TIME, and the read now
 * happens in `SwiftRuntime` — the one place on the server that decides whether
 * Swift exists. They are deliberately not NEXT_PUBLIC_: that prefix inlines a
 * value into the bundle during the build, freezing whatever the build machine
 * happened to have into every prerendered page. On a host that only injects
 * these values at runtime, a static page would bake in nothing and the widget
 * would be silently absent in production. The `connection()` call in
 * `SwiftRuntime` is what makes the runtime read real — it opts the route out of
 * static prerendering. Remove it and that bug comes back.
 *
 * BE HONEST ABOUT WHAT THIS DOES NOT BUY: the widget runs in the visitor's
 * browser and authenticates from there, so these values reach the page source
 * either way. Reading them at runtime buys rotation without a rebuild, not
 * secrecy. Restricting the key to our own origin in the Swift dashboard is what
 * actually limits what it can be used for.
 */
export function SwiftAgentScript({ configured }: { configured: boolean }) {
  if (!configured) return null

  return (
    <Script
      src="https://widget.swiftagents.org/dist/widget-ui.js"
      data-company-id={process.env.SWIFT_COMPANY_ID}
      data-api-key={process.env.SWIFT_API_KEY}
      data-mode="widget"
      data-trigger=".open-chat"
      strategy="afterInteractive"
    />
  )
}
