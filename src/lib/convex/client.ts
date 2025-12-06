import { ConvexReactClient } from "convex/react";

let convexReactClientSingleton: ConvexReactClient | undefined = undefined;

export function getConvexReactClient() {
  const url = import.meta.env.VITE_CONVEX_URL;
  convexReactClientSingleton ??= new ConvexReactClient(url);

  return convexReactClientSingleton;
}
