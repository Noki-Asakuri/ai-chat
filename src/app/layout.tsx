import "@/globals.css";
import "katex/dist/katex.min.css";

import { type Metadata, type Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";

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
        {process.env.ENABLE_REACT_SCAN && (
          <script src="https://unpkg.com/react-scan/dist/auto.global.js" />
        )}
      </head>

      <body className="dark isolate font-sans">{children}</body>
    </html>
  );
}
