import "@/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { ConvexClientProvider } from "./_components/provider/convex-client";
import { Toaster } from "./_components/ui/sonner";

export const metadata: Metadata = {
  title: "AI Chat",
  description: "AI Chat",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} antialiased`}>
      <body className="dark">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
