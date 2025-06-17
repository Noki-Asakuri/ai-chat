"use client";

import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { env } from "@/env";
import { getConvexReactClient } from "@/lib/convex/client";

const convex = getConvexReactClient();

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      waitlistUrl="/auth/waitlist"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
