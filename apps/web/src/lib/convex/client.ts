import { ConvexReactClient } from "convex/react";

import { env } from "@/env";

let convexReactClientSingleton: ConvexReactClient | undefined = undefined;

function createConvexReactClient(): ConvexReactClient {
  const url = env.VITE_CONVEX_URL;
  return new ConvexReactClient(url, {
    expectAuth: true,
    authRefreshTokenLeewaySeconds: 30,
  });
}

export function getConvexReactClient(): ConvexReactClient {
  if (import.meta.env.SSR) return createConvexReactClient();

  convexReactClientSingleton ??= createConvexReactClient();
  return convexReactClientSingleton;
}
