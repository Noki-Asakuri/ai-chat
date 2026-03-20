import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production"]).default("development"),

    PROXY_URL: z.string(),
    PROXY_KEY: z.string(),

    REDIS_URL: z.string(),
    CONVEX_URL: z.string(),
    EXA_API_KEY: z.string(),

    WORKOS_API_KEY: z.string(),
    WORKOS_CLIENT_ID: z.string(),
    WORKOS_COOKIE_PASSWORD: z.string(),

    WEB_APP_ORIGIN: z.string().default("http://localhost:3000"),

    AXIOM_TOKEN: z.string(),
    AXIOM_DATASET: z.string(),

    PUBLIC_ASSET_BASE_URL: z.string(),
    RAW_FILE_BASE_URL: z.string(),
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
