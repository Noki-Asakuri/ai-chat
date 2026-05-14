import { ConvexHttpClient } from "convex/browser";
import type { Context } from "hono";

import { env } from "@/env";

export async function createServerConvexClient(ctx: Context) {
  const auth = ctx.get("auth");
  const accessToken = await auth.getAccessToken();

  return new ConvexHttpClient(env.CONVEX_URL, { auth: accessToken });
}
