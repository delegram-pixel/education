import { connection } from 'next/server'

import { SwiftAgentScript } from '@/components/swift/swift-agent-script'
import { SwiftAvailabilityProvider } from '@/components/swift/swift-availability'
import { hasSwiftCredentials } from '@/lib/swift/config'

/**
 * The single place that decides whether Swift exists on this deployment.
 *
 * It answers the question ONCE, on the server, and hands the answer to both
 * consumers: the client tree (through `SwiftAvailabilityProvider`, so every
 * trigger renders the right control on its first paint) and the script tag
 * itself. One read, one answer, no possibility of the two disagreeing — and
 * nothing for the browser to guess at.
 *
 * `connection()` is what makes that read happen per request rather than being
 * frozen into the build. See `SwiftAgentScript` for why that matters. It must
 * stay inside this component: reading the env vars in `layout.tsx` directly
 * would put them back in the build-time path this is guarding against.
 *
 * Wrapping `children` in a client provider does not affect the "mounted once at
 * the root" requirement the widget depends on. `SwiftRuntime` is rendered by
 * `RootLayout`, so it never remounts on navigation; the page tree passes through
 * it as `children` exactly as it did before.
 */
export async function SwiftRuntime({ children }: { children: React.ReactNode }) {
  await connection()
  const configured = hasSwiftCredentials()

  return (
    <>
      <SwiftAvailabilityProvider configured={configured}>{children}</SwiftAvailabilityProvider>
      <SwiftAgentScript configured={configured} />
    </>
  )
}
