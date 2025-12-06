import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
  if (!CONVEX_URL) console.error("missing envar VITE_CONVEX_URL");

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL);
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",

    Wrap: ({ children }) => (
      <AuthKitProvider
        clientId={import.meta.env.VITE_WORKOS_CLIENT_ID}
        redirectUri={import.meta.env.WORKOS_REDIRECT_URI}
      >
        <ConvexProviderWithAuthKit client={convexQueryClient.convexClient} useAuth={useAuth}>
          {children}
        </ConvexProviderWithAuthKit>
      </AuthKitProvider>
    ),
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
