import type { VercelConfig } from "@vercel/config/v1";
import { routes } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "tanstack-start",
  buildCommand: "bunx convex deploy --cmd 'bun run build'",

  trailingSlash: false,
  rewrites: [routes.rewrite("/api/vercel/:path*", "https://chat.asakuri.me/_vercel/:path*")],
};
