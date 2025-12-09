import { ConvexHttpClient } from "convex/browser";

export type ServerConvexClient = InstanceType<typeof ConvexHttpClient>;

// We create a new Convex client for each request on the server.
export function createServerConvexClient(): ServerConvexClient {
  const serverConvexClient = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
  return serverConvexClient;
}
