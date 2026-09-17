import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'

import { SwiftAgentScript } from '@/components/swift/swift-agent-script'
import { SiteFooter } from '@/components/shared/site-footer'
import { SiteHeader } from '@/components/shared/site-header'
import { ToastProvider } from '@/components/ui/toast'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Admission Copilot — check if you qualify',
    template: '%s · Admission Copilot',
  },
  description:
    'Check your O-level results against a course in about two minutes, get walked through JAMB and POST-UTME registration, and reach a real counselor when you need one.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5F0' },
    { media: '(prefers-color-scheme: dark)', color: '#141406' },
  ],
}

/**
 * Applied before first paint so a returning visitor never sees a flash of the
 * wrong theme. It reads one key and sets one attribute; anything heavier here
 * blocks rendering.
 */
const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem('ac-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only left-4 top-4 z-[70] rounded-md bg-primary px-4 py-2 text-primary-fg focus:not-sr-only focus:absolute"
        >
          Skip to content
        </a>

        <ToastProvider>
          <div className="relative z-[1] flex min-h-dvh flex-col">
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
        </ToastProvider>

        <SwiftAgentScript />
      </body>
    </html>
  )
}
