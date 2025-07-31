import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AxiomWebVitals } from "next-axiom";

import { Authenticated, AuthLoading } from "convex/react";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { toast } from "sonner";

import Home from "./home";

import { LoadingPage } from "@/components/loading-page";
import PostHogIdentify from "@/components/posthog-identify";
import { ConvexClientProvider } from "@/components/provider/convex-client";
import { Toaster } from "@/components/ui/sonner";

import { LoginPage } from "@/frontend/auth/login";
import { WaitlistPage } from "@/frontend/auth/waitlist";

import { AuthLayout } from "./auth/layout";
import { AccountPage } from "./auth/settings/account";
import { AttachmentsPage } from "./auth/settings/attachments";
import { CustomizePage } from "./auth/settings/customize";
import { StatisticsPage } from "./auth/settings/statistics";

import { useVersionWatcher } from "@/lib/hooks/use-version-watcher";

export default function App() {
  return (
    <ConvexClientProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/waitlist" element={<WaitlistPage />} />

          <Route path="/" element={<RootLayout />}>
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
          </Route>
        </Routes>
      </BrowserRouter>

      <Toaster />
      <PostHogIdentify />

      <Analytics basePath="/api/vercel" />
      <SpeedInsights basePath="/api/vercel" />
      <AxiomWebVitals />
    </ConvexClientProvider>
  );
}

function RootLayout() {
  const isNewVersionAvailable = useVersionWatcher();

  useEffect(() => {
    if (isNewVersionAvailable) {
      toast(NewVersionToast, { id: "new-version", duration: Infinity, position: "bottom-right" });
    }
  }, [isNewVersionAvailable]);

  return (
    <>
      <AuthLoading>
        <LoadingPage />
      </AuthLoading>

      <Authenticated>
        <Outlet />
      </Authenticated>
    </>
  );
}

function NewVersionToast() {
  return (
    <div className="flex flex-col gap-2">
      <span>
        A new version is available! Please save your work and refresh to get the latest updates.
      </span>

      <div className="flex w-full gap-2 *:flex-1">
        <button
          className="flex items-center justify-center rounded-md border p-1.5 text-sm hover:underline"
          onClick={() => toast.dismiss("new-version")}
        >
          Dismiss for now
        </button>

        <button
          className="bg-destructive/50 text-destructive-foreground border-destructive flex cursor-pointer items-center justify-center rounded-md border p-1.5 text-sm hover:underline"
          onClick={() => window.location.reload()}
        >
          Refresh Now
        </button>
      </div>
    </div>
  );
}
