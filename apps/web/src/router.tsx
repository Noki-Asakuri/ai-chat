import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { DEFAULT_STORAGE_KEY } from "convex-helpers/react/sessions";
import { type ConvexReactClient } from "convex/react";

import { StrictMode } from "react";

import { DefaultCatchBoundary } from "./_components/default-catch-boundary";
import { DefaultNotFoundBoundary } from "./_components/default-not-found-boundary";

import { getConvexReactClient } from "./lib/convex/client";

import { routeTree } from "./routeTree.gen";

const convexClient = getConvexReactClient();

export function getRouter() {
  const convexQueryClient = new ConvexQueryClient(convexClient);
  ensureAuthSSRConvexClient(convexClient, convexQueryClient);

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
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: DefaultNotFoundBoundary,

    Wrap: ({ children }) => <StrictMode>{children}</StrictMode>,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

async function ensureAuthSSRConvexClient(
  convexClient: ConvexReactClient,
  convexQueryClient: ConvexQueryClient,
) {
  const isServer = import.meta.env.SSR;
  if (!isServer) return;

  console.log("[Server] Setting up auth for server");

  convexClient.setAuth(async function () {
    const auth = await getAuth();
    if (!auth.user) return null;
    return auth.accessToken;
  });

  const auth = await getAuth();
  if (auth.user) {
    convexQueryClient.serverHttpClient?.setAuth(auth.accessToken);
  }
}
