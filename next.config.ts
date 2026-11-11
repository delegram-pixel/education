import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Headers that are safe to enforce today.
 *
 * `frame-ancestors` also appears in the CSP below; `X-Frame-Options` is kept for
 * clients that do not implement CSP. HSTS is production-only: sending it from a
 * local HTTP server is noise at best.
 */
const securityHeaders = [
  ...(isProduction
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000',
        },
      ]
    : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
]

/**
 * The Content-Security-Policy, in REPORT-ONLY mode for now.
 *
 * The session cookie is deliberately readable by JavaScript, and the theme
 * script is inline, so a policy written blind would either break the widget or
 * be so loose it says nothing. Reporting first lets the real violations show up
 * in the browser console before anything is blocked. Once the reports are clean,
 * rename the header to `Content-Security-Policy` and keep this value.
 *
 * `'unsafe-inline'` for scripts is required by the theme bootstrap in
 * `app/layout.tsx` (and by Next's own inline bootstrap). A nonce-based policy is
 * the next step, not this one. `'unsafe-eval'` is development-only: the dev
 * bundler evaluates modules.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} https://widget.swiftagents.org`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://widget.swiftagents.org https://*.swiftagents.org${
    isProduction ? '' : ' ws: wss:'
  }`,
  'frame-src https://*.swiftagents.org',
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Cross-route shared-element morphs (course card -> page header).
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          ...securityHeaders,
          { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
        ],
      },
    ]
  },
}

export default nextConfig
