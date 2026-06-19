/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Exclude heavy server-only packages from webpack bundling.
  // googleapis alone is 114MB — it should be require()'d at runtime, not parsed by webpack.
  serverExternalPackages: ["googleapis", "firebase-admin"],
};

module.exports = nextConfig;
