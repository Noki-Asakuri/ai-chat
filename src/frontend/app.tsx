"use client";

import { useConvexAuth } from "convex/react";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router";
import { toast } from "sonner";

import { LoadingPage } from "@/components/loading-page";

import Home from "./home";

import { useVersionWatcher } from "@/lib/hooks/use-version-watcher";

const Chat = <Home />;

const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, element: Chat },
      { path: "threads/:threadId", element: Chat },
    ],
    ErrorBoundary: () => {
      const pathname = usePathname();

      if (pathname.startsWith("/threads")) return <Navigate to={pathname} replace />;
      return <Navigate to="/" />;
    },
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

function RootLayout() {
  const router = useRouter();
  const isNewVersionAvailable = useVersionWatcher();
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (isNewVersionAvailable) {
      toast(NewVersionToast, { id: "new-version", duration: Infinity, position: "bottom-right" });
    }
  }, [isNewVersionAvailable]);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) router.push("/auth/login");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <LoadingPage />;
  if (!isAuthenticated) return null;

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
