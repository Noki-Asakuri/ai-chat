/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import type { NextConfig } from "next";
import "./src/env.js";

import { withSentryConfig } from "@sentry/nextjs";

function noWrapper(config: NextConfig, ..._args: unknown[]) {
  return config;
}

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { reactCompiler: true },

  skipTrailingSlashRedirect: true,
  turbopack: {},

  env: { NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA },
  async rewrites() {
    const host =
      process.env.NODE_ENV === "production" ? "https://chat.asakuri.me" : "http://localhost:3000";

    return [
      {
        source: "/relay-gTFD/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/relay-gTFD/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/relay-gTFD/flags",
        destination: "https://us.i.posthog.com/flags",
      },
      {
        source: "/api/vercel/:path*",
        destination: `${host}/_vercel/:path*`,
      },
      {
        // 👇 matches all routes except /api
        source: "/((?!api/).*)",
        destination: "/static-app-shell",
      },
    ];
  },
  async redirects() {
    return [
      {
        permanent: true,
        source: "/manifest.json",
        destination: "/manifest.webmanifest",
      },
    ];
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];

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

// Injected content via Sentry wizard below
const withSentry = process.env.NODE_ENV === "production" ? withSentryConfig : noWrapper;

const sentryOptions = {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "ai-chat-2t",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

export default withSentry(nextConfig, sentryOptions);
