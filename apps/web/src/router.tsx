import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { ConvexQueryClient } from "@convex-dev/react-query";

import { StrictMode } from "react";

import { DefaultCatchBoundary } from "./_components/default-catch-boundary";
import { DefaultNotFoundBoundary } from "./_components/default-not-found-boundary";

import { getConvexReactClient } from "./lib/convex/client";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
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
    context: { queryClient, convexClient: convexQueryClient, convexReactClient: convexClient },
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: DefaultNotFoundBoundary,

    Wrap: ({ children }) => <StrictMode>{children}</StrictMode>,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: Awaited<ReturnType<typeof getRouter>>;
  }
}
