import { ConvexReactClient } from "convex/react";
import { cache } from "react";

let convexReactClientSingleton: ConvexReactClient | undefined = undefined;

export const getConvexReactClient = cache(() => {
  const url = import.meta.env.VITE_CONVEX_URL;
  convexReactClientSingleton ??= new ConvexReactClient(url, { verbose: true });

  return convexReactClientSingleton;
});
