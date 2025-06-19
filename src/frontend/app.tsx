import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { BrowserRouter, Route, Routes } from "react-router";

import PostHogIdentify from "@/components/posthog-identify";
import { ConvexClientProvider } from "@/components/provider/convex-client";
import { Toaster } from "@/components/ui/sonner";

import { LoginPage } from "@/frontend/auth/login";
import { WaitlistPage } from "@/frontend/auth/waitlist";

import { AccountPage } from "./auth/settings/account";
import { AuthLayout } from "./auth/settings/auth-layout";

import Home from "./home";

export default function App() {
  return (
    <ConvexClientProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Home />}>
            <Route index element={null} />
            <Route path="/chat/:threadId" element={null} />
          </Route>

          <Route path="/auth/login/*" element={<LoginPage />} />
          <Route path="/auth/waitlist/*" element={<WaitlistPage />} />

          <Route path="/auth/settings" element={<AuthLayout />}>
            <Route path="account/*" element={<AccountPage />} />
            <Route path="usage/*" element={<div>Usage</div>} />
            <Route path="customize/*" element={<div>Customize</div>} />
            <Route path="models/*" element={<div>Models</div>} />
            <Route path="api-keys/*" element={<div>API Keys</div>} />
            <Route path="contact/*" element={<div>Contact</div>} />
          </Route>
        </Routes>
      </BrowserRouter>

      <Toaster />
      <PostHogIdentify />

      <Analytics basePath="/api/vercel" />
      <SpeedInsights basePath="/api/vercel" />
    </ConvexClientProvider>
  );
}
