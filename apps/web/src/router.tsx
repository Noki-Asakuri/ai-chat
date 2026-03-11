import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { DEFAULT_STORAGE_KEY } from "convex-helpers/react/sessions";
import { ConvexProvider } from "convex/react";

import { StrictMode } from "react";

import { DefaultCatchBoundary } from "./_components/default-catch-boundary";
import { DefaultNotFoundBoundary } from "./_components/default-not-found-boundary";

import { env } from "./env";
import { getConvexReactClient } from "./lib/convex/client";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const CONVEX_URL = env.VITE_CONVEX_URL;
  if (!CONVEX_URL) console.error("missing envar VITE_CONVEX_URL");

  const convexClient = getConvexReactClient();
  const convexQueryClient = new ConvexQueryClient(convexClient);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        retry(failureCount, error) {
          const ignoreErrors = ["Not authenticated", "Not authorized"];
          return ignoreErrors.some((e) => error.message.includes(e)) ? false : failureCount < 3;
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (error.message.includes("Not authenticated")) {
          // Hacky way to force a reset of the session on client because of desync.
          void cookieStore.delete(DEFAULT_STORAGE_KEY);
          window.location.reload();
        }
      },
    }),
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient, convexClient: convexQueryClient },
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: DefaultNotFoundBoundary,

    Wrap: ({ children }) => (
      <StrictMode>
        <ConvexProvider client={convexClient}>{children}</ConvexProvider>
      </StrictMode>
    ),
  });

  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
