/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { reactCompiler: true },
  async redirects() {
    return [
      {
        source: "/auth/settings",
        destination: "/auth/settings/account",
        permanent: false,
      },
      {
        source: "/chat",
        destination: "/chat/new",
        permanent: true,
      },
    ];
  },
};

export default config;
