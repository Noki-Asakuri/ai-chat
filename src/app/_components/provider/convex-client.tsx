"use client";

import { ConvexProvider } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

import { getConvexReactClient } from "@/lib/convex/client";

const convex = getConvexReactClient();

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
    </ConvexProvider>
  );
}
