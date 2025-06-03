import { env } from "@/env";

import { ConvexReactClient } from "convex/react";

let convexReactClientSingleton: ConvexReactClient | undefined = undefined;

export function getConvexReactClient() {
  convexReactClientSingleton ??= new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);
  return convexReactClientSingleton;
}
