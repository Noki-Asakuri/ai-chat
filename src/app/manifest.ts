import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Chat",
    short_name: "AI Chat",
    theme_color: "#7f22fe",
    background_color: "#2c1a49",
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
        src: "/icons/icon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: "/icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "/icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
