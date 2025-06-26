import "@/globals.css";
import "katex/dist/katex.min.css";

import { type Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { BotIdClient } from "botid/client";

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

const protectedRoutes = [
  {
    path: "/api/ai/chat",
    method: "POST",
  },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mainFont.variable} ${codeFont.variable} antialiased`}>
      <head>
        <BotIdClient protect={protectedRoutes} />
        {env.NODE_ENV === "development" && (
          <script src="https://unpkg.com/react-scan/dist/auto.global.js" />
        )}
      </head>

      <body className="dark isolate">{children}</body>
    </html>
  );
}
