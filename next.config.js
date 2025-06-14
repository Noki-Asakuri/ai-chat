/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import withSerwistInit from "@serwist/next";

/**
 * @param {import("next").NextConfig} config
 */
function noWrapper(config) {
  return config;
}

const withSerwist =
  process.env.NODE_ENV === "production"
    ? withSerwistInit({
        cacheOnNavigation: true,
        swSrc: "src/app/sw.ts",
        swDest: "public/sw.js",
      })
    : noWrapper;

/** @type {import("next").NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { reactCompiler: true },

  skipTrailingSlashRedirect: true,
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
    ];
  },
  async redirects() {
    return [
      {
        source: "/auth/settings",
        destination: "/auth/settings/account",
        permanent: false,
      },
      {
        source: "/chat",
        destination: "/",
        permanent: true,
      },
      {
        destination: "/manifest.webmanifest",
        permanent: true,
        source: "/manifest.json",
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
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self'; connect-src 'self' https://clerk.chat.asakuri.me https://img.clerk.com https://files.chat.asakuri.me;",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
