import "@/globals.css";
import "katex/dist/katex.min.css";

import { type Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { ConvexClientProvider } from "./_components/provider/convex-client";
import { Toaster } from "./_components/ui/sonner";

import { env } from "@/env";

export const metadata: Metadata = {
  title: "AI Chat",
  description: "AI Chat",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
  manifest: "/manifest.json",
};

const mainFont = Be_Vietnam_Pro({
  display: "swap",
  weight: ["200", "300"],
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  variable: "--font-main",
});

const codeFont = JetBrains_Mono({
  display: "swap",
  weight: ["200", "300"],
  style: ["normal", "italic"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-codeblock",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mainFont.variable} ${codeFont.variable} antialiased`}>
      <head>
        {env.NODE_ENV === "development" && (
          <script src="https://unpkg.com/react-scan/dist/auto.global.js" />
        )}
      </head>

      <body className="dark">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Toaster />

        <Analytics basePath="/api/vercel" />
        <SpeedInsights basePath="/api/vercel" />
      </body>
    </html>
  );
}
