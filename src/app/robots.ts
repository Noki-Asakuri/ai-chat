import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    host: "https://chat.asakuri.me",
    rules: {
      allow: ["/"],
      userAgent: "*",
      disallow: ["/auth/login", "/auth/settings/*", "/auth/waitlist", "/api/*"],
    },
    sitemap: "https://chat.asakuri.me/sitemap.xml",
  };
}
