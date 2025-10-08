import { ConvexHttpClient } from "convex/browser";
import { env } from "@/env";

export const serverConvexClient = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);

export function createServerConvexClient(token: string) {
  return new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL, { auth: token });
}
