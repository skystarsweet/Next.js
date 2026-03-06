/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  // assetPrefix needed for Electron static file loading (relative paths)
  assetPrefix: process.env.NEXT_PUBLIC_ELECTRON === 'true' ? './' : '',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
