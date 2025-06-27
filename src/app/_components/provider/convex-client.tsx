"use client";

import { ClerkProvider, useAuth } from "@clerk/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { env } from "@/env";
import { getConvexReactClient } from "@/lib/convex/client";

const convex = getConvexReactClient();
const convexQueryClient = new ConvexQueryClient(convex);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { queryKeyHashFn: convexQueryClient.hashFn(), queryFn: convexQueryClient.queryFn() },
  },
});
convexQueryClient.connect(queryClient);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      waitlistUrl="/auth/waitlist"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ConvexQueryCacheProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ConvexQueryCacheProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
