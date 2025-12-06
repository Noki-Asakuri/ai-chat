import { ConvexHttpClient } from "convex/browser";

export type ServerConvexClient = InstanceType<typeof ConvexHttpClient>;

export function createServerConvexClient(token: string): ServerConvexClient {
  const serverConvexClient = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
  serverConvexClient.setAuth(token);

  return serverConvexClient;
}
