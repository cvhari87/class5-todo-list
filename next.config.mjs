/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}/__/auth/:path*`,
      },
    ]
  },
}

export default nextConfig
