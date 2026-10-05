import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@stable/auth",
    "@stable/config",
    "@stable/contracts",
    "@stable/current-club-context",
    "@stable/design-tokens",
    "@stable/observability",
    "@stable/permissions",
  ],
  // Workspace packages import TypeScript sources with .js specifiers.
  // Next.js 16.3.8 applies extensionAlias in webpack, not in Turbopack.
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    },
  },
};

export default nextConfig;
