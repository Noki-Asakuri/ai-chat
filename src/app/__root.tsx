/// <reference types="vite/client" />

import appCss from "@/styles/globals.css?url";

import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { getAuth } from "@/lib/authkit/serverFunctions";

type RootContext = { queryClient: QueryClient };

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
  beforeLoad: async () => {
    const { user } = await getAuth();
    return { user };
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
  return (
    <html>
      <head>
        <HeadContent />
      </head>

      <body>
        {children}
        <Scripts />

        {import.meta.env.PROD && (
          <>
            <Analytics basePath="/api/vercel" />
            <SpeedInsights basePath="/api/vercel" />
          </>
        )}

        <TanStackDevtools
          config={{ position: "bottom-left" }}
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
