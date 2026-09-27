import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep Next's own indicator away from the toolbar at the bottom.
  devIndicators: { position: 'top-right' },
  experimental: { requestInsights: true },
}

export default nextConfig
