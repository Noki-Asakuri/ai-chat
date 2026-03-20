import { ConvexHttpClient } from "convex/browser";

import { env } from "../env";

export type ServerConvexClient = InstanceType<typeof ConvexHttpClient>;

export function createServerConvexClient(accessToken: string): ServerConvexClient {
  const serverConvexClient = new ConvexHttpClient(env.CONVEX_URL, { auth: accessToken });
  return serverConvexClient;
}
