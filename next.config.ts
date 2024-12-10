/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [],
    domains: [],
    unoptimized: true
  }
}

module.exports = nextConfig