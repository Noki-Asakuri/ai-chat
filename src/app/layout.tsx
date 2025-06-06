import "@/globals.css";

import { type Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

import { ConvexClientProvider } from "./_components/provider/convex-client";
import { Toaster } from "./_components/ui/sonner";

export const metadata: Metadata = {
  title: "AI Chat",
  description: "AI Chat",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const poppins = Poppins({
  display: "swap",
  weight: ["300"],
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-poppins",
});

const jetBrainsMono = JetBrains_Mono({
  display: "swap",
  weight: ["200", "400"],
  style: ["normal", "italic"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-jetbrains-mono",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${jetBrainsMono.variable} antialiased`}>
      <body className="dark">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Toaster />

        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
