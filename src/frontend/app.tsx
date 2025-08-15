import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { useConvexAuth } from "convex/react";
import { useEffect } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router";
import { toast } from "sonner";

import { LoadingPage } from "@/components/loading-page";
import { ConvexClientProvider } from "@/components/provider/convex-client";
import { Toaster } from "@/components/ui/sonner";

import { LoginPage } from "@/frontend/auth/login";
import { WaitlistPage } from "@/frontend/auth/waitlist";

import Home from "./home";

import { AuthLayout } from "./auth/layout";

import { useVersionWatcher } from "@/lib/hooks/use-version-watcher";

const Chat = <Home />;

const router = createBrowserRouter([
  { path: "/auth/login", Component: LoginPage },
  { path: "/auth/waitlist", Component: WaitlistPage },

  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, element: Chat },
      { path: "chat/:threadId", element: Chat },

      {
        path: "/auth/settings",
        Component: AuthLayout,
        children: [
          {
            path: "account",
            lazy: async () => {
              const [{ AccountPage }] = await Promise.all([
                import("./auth/settings/account"),
                import("@/styles/clerk-user-profile.css"),
              ]);
              return { Component: AccountPage };
            },
          },
          {
            path: "statistics",
            lazy: () =>
              import("./auth/settings/statistics").then((m) => ({
                Component: m.StatisticsPage,
              })),
          },
          {
            path: "customize",
            lazy: () =>
              import("./auth/settings/customize").then((m) => ({
                Component: m.CustomizePage,
              })),
          },
          {
            path: "attachments",
            lazy: () =>
              import("./auth/settings/attachments").then((m) => ({
                Component: m.AttachmentsPage,
              })),
          },
          {
            path: "models",
            lazy: () =>
              import("./auth/settings/models").then((m) => ({
                Component: m.ModelsPage,
              })),
          },
          {
            path: "ai-profiles",
            lazy: () =>
              import("./auth/settings/ai-profiles").then((m) => ({
                Component: m.AiProfilesPage,
              })),
          },

          { index: true, element: <Navigate to="account" replace /> },
          { path: "*", element: <Navigate to="/auth/settings/account" replace /> },
        ],
      },
    ],
    errorElement: <Navigate to="/" replace />,
  },
]);

export default function App() {
  return (
    <ConvexClientProvider>
      <RouterProvider router={router} />
      <Toaster />

      {process.env.ENV === "production" && (
        <>
          <Analytics basePath="/api/vercel" />
          <SpeedInsights basePath="/api/vercel" />
        </>
      )}
    </ConvexClientProvider>
  );
}

function RootLayout() {
  const isNewVersionAvailable = useVersionWatcher();
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (isNewVersionAvailable) {
      toast(NewVersionToast, { id: "new-version", duration: Infinity, position: "bottom-right" });
    }
  }, [isNewVersionAvailable]);

  if (isLoading) return <LoadingPage />;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;

  return <Outlet />;
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
