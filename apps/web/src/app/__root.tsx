/// <reference types="vite/client" />

import { tryCatch } from "@ai-chat/shared/utils/async";

import appCss from "@/styles/globals.css?url";

import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useNavigate,
  type AnyRouteMatch,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { type ConvexQueryClient } from "@convex-dev/react-query";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { SessionProvider } from "convex-helpers/react/sessions";
import { ConvexProviderWithAuth } from "convex/react";
import { useCallback, useMemo } from "react";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { DefaultNotFoundBoundary } from "@/components/default-not-found-boundary";
import { Toaster } from "@/components/ui/sonner";
import { VersionUpdateNotifier } from "@/components/version-update-notifier";

import {
  CHAT_NAVIGATE_TO_THREAD_EVENT,
  type NavigateToThreadEventDetail,
} from "@/lib/chat/notification-navigation";
import { getConvexReactClient } from "@/lib/convex/client";
import { sessionUseCookie } from "@/lib/hooks/use-cookie";
import { useWindowEvent } from "@/lib/hooks/use-window-event";
import { fromUUID, toUUID } from "@/lib/utils";

type RootContext = {
  queryClient: QueryClient;
  convexClient: ConvexQueryClient;
};

export const Route = createRootRouteWithContext<RootContext>()({
  head: () => {
    const scripts: AnyRouteMatch["headScripts"] = [];

    if (import.meta.env.DEV) {
      scripts.push({ src: "//unpkg.com/react-scan/dist/auto.global.js", crossOrigin: "anonymous" });
    }

    return {
      meta: [
        { charSet: "utf-8" },
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
        },

        { title: "AI Chat" },
        {
          name: "description",
          content: "An advanced AI chat application, featuring a modern UI and a rich feature set.",
        },

        // --- Visuals ---
        { name: "color-scheme", content: "dark" },
        { name: "theme-color", content: "#1a1a1a" },

        // --- iOS PWA Specifics ---
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "AI Chat" },

        // --- Open Graph / Social ---
        { property: "og:title", content: "AI Chat" },
        { property: "og:description", content: "An advanced AI chat application." },
        { property: "og:image", content: "/screenshots/social-preview.png" },
        { property: "og:url", content: "https://chat.asakuri.me" },
        { name: "twitter:card", content: "summary_large_image" },

        // --- Twitter Specifics ---
        { name: "twitter:title", content: "AI Chat" },
        { name: "twitter:description", content: "An advanced AI chat application." },
        { name: "twitter:image", content: "/screenshots/social-preview.png" },
        { name: "twitter:url", content: "https://chat.asakuri.me" },
      ],
      links: [
        // Manifests
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },

        // Icons
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "icon", href: "/favicon.ico", sizes: "any" }, // "any" is better for .ico
        { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
        { rel: "icon", href: "/icon-256.png", type: "image/png", sizes: "256x256" },
        { rel: "icon", href: "/icon-512.png", type: "image/png", sizes: "512x512" },
      ],
      scripts,
    };
  },
  beforeLoad: async () => {
    const auth = await getAuth();
    if (!auth.user) return { user: undefined, sessionId: undefined };

    return { user: auth.user, sessionId: auth.sessionId };
  },
  loader: async ({ context }) => {
    return { user: context.user, sessionId: context.sessionId };
  },

  shellComponent: RootLayout,
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: DefaultNotFoundBoundary,
});

export function RootLayout() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

const convex = getConvexReactClient();

function RootDocument({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const loaderData = Route.useLoaderData();

  useWindowEvent<CustomEvent<NavigateToThreadEventDetail>>(
    CHAT_NAVIGATE_TO_THREAD_EVENT,
    async function handleNavigateToThread(event) {
      const detail = event.detail;
      if (!detail) return;

      const threadId = detail.threadId;
      if (!threadId) return;

      const currentThreadId = fromUUID(window.location.pathname.split("/")[2]);
      if (currentThreadId === threadId) return;

      await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(threadId) } });
    },
  );

  return (
    <html lang="en" className="antialiased">
      <head>
        <HeadContent />
      </head>

      <body className="dark isolate max-h-svh overflow-hidden font-sans">
        <AuthKitProvider
          initialAuth={
            loaderData.user && loaderData.sessionId
              ? { user: loaderData.user, sessionId: loaderData.sessionId }
              : { user: null }
          }
        >
          <ConvexProviderWithAuth client={convex} useAuth={useAuthFromWorkOS}>
            <SessionProvider useStorage={sessionUseCookie}>{children}</SessionProvider>
          </ConvexProviderWithAuth>
        </AuthKitProvider>

        <Scripts />
        <Toaster />
        <VersionUpdateNotifier />

        {import.meta.env.PROD && (
          <>
            <Analytics basePath="/api/vercel" />
            <SpeedInsights basePath="/api/vercel" />
          </>
        )}

        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Query",
              render: <ReactQueryDevtoolsPanel />,
              defaultOpen: true,
            },
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
              defaultOpen: false,
            },
          ]}
        />
      </body>
    </html>
  );
}

function useAuthFromWorkOS() {
  const { user, loading } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const fetchAccessToken = useCallback(
    async function ({ forceRefreshToken }: { forceRefreshToken: boolean }) {
      console.log("[Auth] Fetching access token");
      if (forceRefreshToken) {
        console.log("[Auth] Forcing refresh token");
        await refresh();
      }

      const [token] = await tryCatch(getAccessToken());
      return token ?? null;
    },
    [getAccessToken, refresh],
  );

  return useMemo(
    () => ({ isLoading: loading, isAuthenticated: !!user, fetchAccessToken }),
    [loading, user, fetchAccessToken],
  );
}
