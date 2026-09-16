/**
 * Swift Agents widget — type declarations.
 *
 * This is the COMPLETE documented API surface as of docs.swiftagents.org:
 * five methods and one getter. There are no events, no callbacks, and no way
 * to prefill, inject, or programmatically send a message.
 *
 * Do not add speculative members to this interface. If a feature appears to
 * need one, the feature needs redesigning — see `AskCopilotButton` for the
 * supported pattern (copy to clipboard, then open the panel).
 */

export type SwiftMountOptions = {
  baseUrl?: string
  apiKey?: string
  mode?: 'widget' | 'button'
  trigger?: string
}

declare global {
  interface Window {
    SwiftAgentWidget?: {
      mount(companyId: string, options?: SwiftMountOptions): void
      unmount(): void
      open(): void
      close(): void
      toggle(): void
      readonly isLoaded: boolean
    }
  }
}

export {}
