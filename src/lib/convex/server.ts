import { ConvexHttpClient } from "convex/browser";
import { env } from "@/env";

export type ServerConvexClient = InstanceType<typeof ConvexHttpClient>;

export function createServerConvexClient(token: string): ServerConvexClient {
  const serverConvexClient = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  serverConvexClient.setAuth(token);

  return serverConvexClient;
}
