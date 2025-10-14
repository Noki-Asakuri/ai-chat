import "@/styles/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { type Metadata, type Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { Providers } from "@/components/provider/main-providers";
import { Toaster } from "@/components/ui/sonner";

import { WebVitals } from "@/lib/axiom/client";

export const metadata: Metadata = {
  title: "AI Chat",
  description:
    "An advanced AI chat application built with the T3 stack, featuring a modern UI and a rich feature set.",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  initialScale: 1,
  width: "device-width",
  themeColor: { color: "#1a1a1a", media: "(prefers-color-scheme: dark)" },
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const mainFont = Space_Grotesk({
  display: "swap",
  weight: ["300"],
  subsets: ["latin", "vietnamese"],
  style: ["normal"],
  variable: "--font-main",
});

const codeFont = JetBrains_Mono({
  display: "swap",
  weight: ["200", "300"],
  style: ["normal", "italic"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-codeblock",
});

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mainFont.variable} ${codeFont.variable} antialiased`}>
      <head>
        {process.env.ENABLE_REACT_SCAN && (
          <script defer src="https://unpkg.com/react-scan/dist/auto.global.js" />
        )}

        <script defer data-domain="chat.asakuri.me" src="/api/nothing-here"></script>
      </head>

      <WebVitals />

      <body className="dark isolate font-sans">
        <Providers>{children}</Providers>
        <Toaster />

        {process.env.NEXT_PUBLIC_ENV === "production" && (
          <>
            <Analytics basePath="/api/vercel" />
            <SpeedInsights basePath="/api/vercel" />
          </>
        )}
      </body>
    </html>
  );
}
