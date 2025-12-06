/// <reference types="vite/client" />

import appCss from "@/styles/globals.css?url";

import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { useConvex, type ConvexQueryClient } from "@convex-dev/react-query";
import { useEffect } from "react";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { Toaster } from "@/components/ui/sonner";

import { getAuth } from "@/lib/authkit/serverFunctions";

type RootContext = {
  queryClient: QueryClient;
  convexClient: ConvexQueryClient;
};

export const Route = createRootRouteWithContext<RootContext>()({
  head: () => ({
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
      { name: "theme-color", content: "#1a1a1a" },
      { name: "color-scheme", content: "dark" },
      { name: "theme-color", content: "#1a1a1a", media: "(prefers-color-scheme: dark)" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { user, accessToken } = await getAuth();

    if (user) context.convexClient.serverHttpClient?.setAuth(accessToken);
    return { user, accessToken };
  },
  loader: async ({ context }) => {
    return { user: context.user, accessToken: context.accessToken };
  },

  shellComponent: RootLayout,
  notFoundComponent: () => <p>Not Found</p>,
});

export function RootLayout() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { accessToken } = Route.useLoaderData();
  const client = useConvex();

  useEffect(() => {
    if (accessToken) client.setAuth(async () => accessToken);
  }, []);

  return (
    <html lang="en" className="antialiased">
      <head>
        <HeadContent />
      </head>

      <body className="dark isolate font-sans">
        {children}

        <Scripts />
        <Toaster />

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
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
              defaultOpen: false,
            },
            {
              name: "Tanstack Query",
              render: <ReactQueryDevtoolsPanel />,
              defaultOpen: true,
            },
          ]}
        />
      </body>
    </html>
  );
}
