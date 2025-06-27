import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { Authenticated, AuthLoading, useConvexAuth } from "convex/react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";

import PostHogIdentify from "@/components/posthog-identify";
import { ConvexClientProvider } from "@/components/provider/convex-client";
import { Toaster } from "@/components/ui/sonner";

import { LoginPage } from "@/frontend/auth/login";
import { WaitlistPage } from "@/frontend/auth/waitlist";

import { AccountPage } from "./auth/settings/account";
import { AuthLayout } from "./auth/settings/auth-layout";
import { CustomizePage } from "./auth/settings/customize";
import { StatisticsPage } from "./auth/settings/statistics";

import { LoadingPage } from "@/components/loading-page";
import { AttachmentsPage } from "./auth/settings/attachments";
import Home from "./home";

export default function App() {
  return (
    <ConvexClientProvider>
      <Routers />

      <Toaster />
      <PostHogIdentify />

      <Analytics basePath="/api/vercel" />
      <SpeedInsights basePath="/api/vercel" />
    </ConvexClientProvider>
  );
}

function Routers() {
  const { isLoading } = useConvexAuth();
  if (isLoading) return <LoadingPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/waitlist" element={<WaitlistPage />} />

        <Route element={<Home />}>
          <Route index element={null} />
          <Route path="/chat/:threadId" element={null} />
        </Route>

        <Route path="/auth/settings" element={<AuthLayout />}>
          <Route index element={<Navigate to="account" replace />} />
          <Route path="account/*" element={<AccountPage />} />
          <Route path="statistics/*" element={<StatisticsPage />} />
          <Route path="customize/*" element={<CustomizePage />} />
          <Route path="attachments/*" element={<AttachmentsPage />} />
          <Route path="models/*" element={<div>Models</div>} />
          <Route path="api-keys/*" element={<div>API Keys</div>} />
          <Route path="contact/*" element={<div>Contact</div>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
