import { ConvexReactClient } from "convex/react";

import { env } from "@/env";

let convexReactClientSingleton: ConvexReactClient | undefined = undefined;

export function getConvexReactClient() {
  convexReactClientSingleton ??= new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);
  return convexReactClientSingleton;
}
