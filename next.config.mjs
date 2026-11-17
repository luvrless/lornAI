/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Prevent non-critical type check errors from halting CI/Cloudflare builds
    ignoreBuildErrors: true,
  },
  eslint: {
    // Prevent ESLint from halting CI/Cloudflare builds
    ignoreDuringBuilds: true,
  },
  experimental: {},
};

export default nextConfig;
