import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Cross-route shared-element morphs (course card -> page header).
    viewTransition: true,
  },
}

export default nextConfig
