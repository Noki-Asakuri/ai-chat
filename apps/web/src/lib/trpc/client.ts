import type { AppRouter, RouterInput } from "../../../../server/src/trpc/router";

import { createTRPCClient, httpBatchLink } from "@trpc/client";

import { env } from "@/env";

let trpcClientSingleton: ReturnType<typeof createTRPCClient<AppRouter>> | undefined;

function getTRPCBaseUrl(): string {
  return new URL("/api/trpc", env.VITE_API_ENDPOINT).toString();
}

export function getTRPCClient() {
  if (trpcClientSingleton) return trpcClientSingleton;

  trpcClientSingleton = createTRPCClient<AppRouter>({
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

export async function syncThreadModelConfig(input: RouterInput["thread"]["syncModelConfig"]) {
  const client = getTRPCClient();
  await client.thread.syncModelConfig.mutate(input);
}

export async function regenerateThreadTitle(input: RouterInput["thread"]["regenerateTitle"]) {
  const client = getTRPCClient();
  await client.thread.regenerateTitle.mutate(input);
}
