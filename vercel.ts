import type { VercelConfig, Rewrite } from "@vercel/config/v1";
import { routes } from "@vercel/config/v1";

export const config: VercelConfig = {
  trailingSlash: false,
  rewrites: [
    routes.rewrite("/api/vercel/:path*", "https://chat.asakuri.me/_vercel/:path*") as Rewrite,
  ],
};
