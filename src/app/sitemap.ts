import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://chat.asakuri.me",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
