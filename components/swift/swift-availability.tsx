'use client'

import * as React from 'react'

/**
 * Whether Swift is deployed here, published by the server.
 *
 * `null` means "the server has not said", which only happens to a trigger
 * rendered outside `SwiftRuntime`. It is deliberately distinct from `false`:
 * `false` is a fact that justifies showing the counselor route as the primary
 * control, while `null` is ignorance, and nothing should demote Swift over
 * ignorance. Treat `false` as the only value that changes which control renders.
 */
const SwiftAvailabilityContext = React.createContext<boolean | null>(null)

export function SwiftAvailabilityProvider({
  configured,
  children,
}: {
  configured: boolean
  children: React.ReactNode
}) {
  return (
    <SwiftAvailabilityContext.Provider value={configured}>
      {children}
    </SwiftAvailabilityContext.Provider>
  )
}

export function useSwiftConfigured(): boolean | null {
  return React.useContext(SwiftAvailabilityContext)
}
