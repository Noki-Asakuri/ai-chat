/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import type { NextConfig } from "next";
import "./src/env.js";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  experimental: {
    optimisticClientCache: true,
    turbopackFileSystemCacheForDev: true,
  },

  reactCompiler: true,
  skipTrailingSlashRedirect: true,

  env: {
    NEXT_PUBLIC_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  },
  async rewrites() {
    const isProduction = process.env.NODE_ENV === "production";
    const host = isProduction ? "https://chat.asakuri.me" : "http://localhost:3000";

    return {
      beforeFiles: [
        {
          source: "/api/vercel/:path*",
          destination: `${host}/_vercel/:path*`,
        },
        {
          source: "/api/plausible-script",
          destination: "https://plausible.asakuri.me/js/script.file-downloads.outbound-links.js",
        },
        {
          source: "/api/plausible/event",
          destination: "https://plausible.asakuri.me/api/event",
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
