import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { type Metadata, type Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { Providers } from "@/components/provider/main-providers";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider appearance={{ cssLayerName: "clerk" }}>
      <html lang="en" className={`${mainFont.variable} ${codeFont.variable} antialiased`}>
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
    </ClerkProvider>
  );
}
