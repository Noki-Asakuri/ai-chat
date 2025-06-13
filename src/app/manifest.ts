import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Chat",
    short_name: "AI Chat",
    theme_color: "#09090b",
    background_color: "#09090b",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
  };
}
