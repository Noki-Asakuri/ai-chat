import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useParams } from "@tanstack/react-router";

import { syncThreadModelConfig } from "@/lib/trpc/client";
import type { ReasoningEffort } from "@/lib/types";
import { fromUUID, tryCatch } from "@/lib/utils";

type SyncThreadModelConfigOptions = {
  threadId?: Id<"threads">;
  model?: string;
  modelParams?: Partial<{
    webSearch: boolean;
    effort: ReasoningEffort;
    profile: Id<"profiles"> | null;
  }>;
};

/**
 * Saves the given model settings to the thread (the current route's thread unless `threadId` is
 * set). Send only the fields that changed: the server merges them into the stored config, so a
 * save never overwrites another setting with a value the client may hold from an older snapshot.
 */
export function useSyncThreadModelConfig() {
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  async function syncThreadModelConfigWrapper(options: SyncThreadModelConfigOptions) {
    const threadId = options.threadId ?? fromUUID<Id<"threads">>(params?.threadId);
    if (!threadId) return;

    const [, error] = await tryCatch(
      syncThreadModelConfig({ threadId, model: options.model, modelParams: options.modelParams }),
    );

    if (error) {
      console.error("[Chat] Failed to sync model config", error);
    }
  }

  return { syncThreadModelConfig: syncThreadModelConfigWrapper };
}
