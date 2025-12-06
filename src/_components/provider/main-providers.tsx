"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { getConvexReactClient } from "@/lib/convex/client";

export const convex = getConvexReactClient();
const convexQueryClient = new ConvexQueryClient(convex);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: convexQueryClient.queryFn(),
      queryKeyHashFn: convexQueryClient.hashFn(),
    },
  },
});
convexQueryClient.connect(queryClient);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConvexProviderWithClerk>
  );
}
