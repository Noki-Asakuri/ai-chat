import { ConvexReactClient } from "convex/react";

let convexReactClientSingleton: ConvexReactClient | undefined = undefined;

export function getConvexReactClient() {
  convexReactClientSingleton ??= new ConvexReactClient(import.meta.env.VITE_CONVEX_URL, {
    expectAuth: true,
  });

  return convexReactClientSingleton;
}
