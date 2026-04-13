import {
  regenerateThreadTitleInputSchema,
  syncThreadModelConfigInputSchema,
  type RegenerateThreadTitleInput,
  type SyncThreadModelConfigInput,
} from "@ai-chat/shared/chat/trpc";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";

import { env } from "@/env";

let trpcClientSingleton: ReturnType<typeof createTRPCUntypedClient> | undefined;

function getTRPCBaseUrl(): string {
  return new URL("/api/trpc", env.VITE_API_ENDPOINT).toString();
}

export function getTRPCClient() {
  if (trpcClientSingleton) return trpcClientSingleton;

  trpcClientSingleton = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url: getTRPCBaseUrl(),
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });

  return trpcClientSingleton;
}

export async function syncThreadModelConfig(input: SyncThreadModelConfigInput): Promise<void> {
  const client = getTRPCClient();
  await client.mutation("thread.syncModelConfig", syncThreadModelConfigInputSchema.parse(input));
}

export async function regenerateThreadTitle(input: RegenerateThreadTitleInput): Promise<void> {
  const client = getTRPCClient();
  await client.mutation("thread.regenerateTitle", regenerateThreadTitleInputSchema.parse(input));
}
