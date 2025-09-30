/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    useCache: true,
    clientSegmentCache: true,
    turbopackPersistentCachingForDev: true,
    turbopackPersistentCachingForBuild: true,
  },

  turbopack: {},
  reactCompiler: true,
  skipTrailingSlashRedirect: true,

  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_ENV: process.env.NODE_ENV,
  },
  async rewrites() {
    const host =
      process.env.NODE_ENV === "production" ? "https://chat.asakuri.me" : "http://localhost:3000";

    return {
      beforeFiles: [
        {
          source: "/api/vercel/:path*",
          destination: `${host}/_vercel/:path*`,
        },
        {
          source: "/threads/:path",
          destination: "/static-chat-shell",
        },
        {
          source: "/",
          destination: "/static-chat-shell",
        },
      ],
    };
  },
  async redirects() {
    return [
      {
        permanent: true,
        source: "/manifest.json",
        destination: "/manifest.webmanifest",
      },
      {
        permanent: true,
        source: "/settings",
        destination: "/settings/account",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
