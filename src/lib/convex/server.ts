import "server-only";

import { env } from "@/env";
import { ConvexHttpClient } from "convex/browser";

export const serverConvexClient = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
