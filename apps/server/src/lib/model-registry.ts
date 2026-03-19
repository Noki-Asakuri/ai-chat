import { createModelRegistry } from "@ai-chat/shared/chat/models/runtime-registry";

import { env } from "../env";

export const registry = createModelRegistry({
  proxyUrl: env.PROXY_URL,
  proxyKey: env.PROXY_KEY,
  isDevelopment: env.NODE_ENV === "development",
});
