import "@/globals.css";

import { type Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";

import { ConvexClientProvider } from "./_components/provider/convex-client";
import { Toaster } from "./_components/ui/sonner";

export const metadata: Metadata = {
  title: "AI Chat",
  description: "AI Chat",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${jetBrainsMono.variable} antialiased`}>
      <body className="dark">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
