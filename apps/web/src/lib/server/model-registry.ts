import { createServerOnlyFn } from "@tanstack/react-start";

import { createModelRegistry } from "@ai-chat/shared/chat/models/runtime-registry";

import { env } from "@/env";

const baseRegistry = createModelRegistry({
  proxyUrl: env.PROXY_URL,
  proxyKey: env.PROXY_KEY,
  isDevelopment: env.NODE_ENV === "development",
});

export const registry: typeof baseRegistry = createServerOnlyFn((...args) => {
  return baseRegistry(...args);
});
