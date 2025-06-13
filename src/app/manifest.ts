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
    screenshots: [
      {
        src: "/screenshots/mobile-screenshot-1.png",
        sizes: "408x905",
        type: "image/png",
        form_factor: "narrow",
        label: "App view on mobile",
      },
      {
        src: "/screenshots/desktop-screenshot-1.png",
        sizes: "1858x993",
        type: "image/png",
        form_factor: "wide",
        label: "App view on desktop",
      },
    ],
    icons: [
      {
        src: "favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
