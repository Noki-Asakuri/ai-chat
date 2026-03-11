import { ConvexHttpClient } from "convex/browser";

import { env } from "../env";

export type ServerConvexClient = InstanceType<typeof ConvexHttpClient>;

export function createServerConvexClient(): ServerConvexClient {
  const serverConvexClient = new ConvexHttpClient(env.CONVEX_URL);
  return serverConvexClient;
}
