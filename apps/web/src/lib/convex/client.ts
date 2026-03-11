import { ConvexReactClient } from "convex/react";
import { cache } from "react";

import { env } from "@/env";

let convexReactClientSingleton: ConvexReactClient | undefined = undefined;

export const getConvexReactClient = cache(() => {
  const url = env.VITE_CONVEX_URL;
  convexReactClientSingleton ??= new ConvexReactClient(url);

  return convexReactClientSingleton;
});
