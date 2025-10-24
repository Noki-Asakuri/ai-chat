"use client";

import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { getConvexReactClient } from "@/lib/convex/client";

import { env } from "@/env";

export const convex = getConvexReactClient();
const convexQueryClient = new ConvexQueryClient(convex);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { queryKeyHashFn: convexQueryClient.hashFn(), queryFn: convexQueryClient.queryFn() },
  },
});
convexQueryClient.connect(queryClient);

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <ClerkProvider
      signInUrl="/auth/login"
      signUpUrl="/auth/login"
      waitlistUrl="/auth/wait-list"
      afterSignOutUrl="/auth/login"
      routerPush={(href) => router.push(href)}
      routerReplace={(href) => router.replace(href)}
      appearance={{ cssLayerName: "clerk" }}
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
