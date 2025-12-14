import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";
import { StrictMode } from "react";

import { getConvexReactClient } from "./lib/convex/client";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const CONVEX_URL: string = import.meta.env.VITE_CONVEX_URL;
  if (!CONVEX_URL) console.error("missing envar VITE_CONVEX_URL");

  const convexClient = getConvexReactClient();
  const convexQueryClient = new ConvexQueryClient(convexClient);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { queryKeyHashFn: convexQueryClient.hashFn(), queryFn: convexQueryClient.queryFn() },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient, convexClient: convexQueryClient },
    defaultPreload: "intent",
    scrollRestoration: true,

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
