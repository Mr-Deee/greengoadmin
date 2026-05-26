/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove swcMinify - it's enabled by default in Next.js 15
  images: {
    domains: ['firebasestorage.googleapis.com'],
    // Add timeout for images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // Add remote patterns for Firebase Storage
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/v0/b/greengohub.firebasestorage.app/**',
      },
    ],
  },
  // Turbopack configuration
  turbopack: {
    root: process.cwd(),
  },
}

module.exports = nextConfig