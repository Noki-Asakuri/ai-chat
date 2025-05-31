import { env } from "@/env";

import { ConvexClient } from "convex/browser";
import { ConvexReactClient } from "convex/react";

let convexReactClientSingleton: ConvexReactClient | undefined = undefined;
let convexClientSingleton: ConvexClient | undefined = undefined;

export function getConvexReactClient() {
  convexReactClientSingleton ??= new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);
  return convexReactClientSingleton;
}

export function getConvexClient() {
  convexClientSingleton ??= new ConvexClient(env.NEXT_PUBLIC_CONVEX_URL);
  return convexClientSingleton;
}
