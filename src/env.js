import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";

import { z } from "zod/v4";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z.enum(["development", "production"]).default("development"),

    CONVEX_DEPLOYMENT: z.string(),

    PROXY_URL: z.string(),
    PROXY_KEY: z.string(),
    REDIS_URL: z.string(),

    WORKOS_API_KEY: z.string(),
    WORKOS_COOKIE_PASSWORD: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `VITE_`.
   */
  client: {
    VITE_CONVEX_URL: z.string(),

    VITE_WORKOS_REDIRECT_URI: z.string(),
    VITE_WORKOS_CLIENT_ID: z.string(),

    VITE_AXIOM_TOKEN: z.string(),
    VITE_AXIOM_DATASET: z.string(),

    VITE_API_ENDPOINT: z.string(),
  },

  clientPrefix: "VITE_",

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: typeof window === "undefined" ? process.env : import.meta.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,

  extends: [vercel()],
});
