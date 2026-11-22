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
  /** Skip the save unless the thread still uses this model (checked on the server). */
  expectedModel?: string;
  /** Called when the request fails. */
  onFailure?: () => void;
};

const threadSaveQueues = new Map<string, Promise<unknown>>();

/**
 * Runs `save` after every earlier save queued for the same thread has settled. Each save is a
 * separate request, so without this a later save (an effort after a model) could reach the server
 * first and be skipped or overwritten.
 */
export function enqueueThreadSave<T>(threadId: string, save: () => Promise<T>): Promise<T> {
  const previous = threadSaveQueues.get(threadId) ?? Promise.resolve();
  const next = previous.then(save, save);
  threadSaveQueues.set(threadId, next);
  const release = () => {
    if (threadSaveQueues.get(threadId) === next) threadSaveQueues.delete(threadId);
  };
  next.then(release, release);
  return next;
}

/**
 * Saves the given model settings to the thread (the current route's thread unless `threadId` is
 * set). Send only the fields that changed: the server merges them into the stored config, so a
 * save never overwrites another setting with a value the client may hold from an older snapshot.
 * Saves to one thread run in the order they were made. Resolves to whether the request succeeded.
 */
export function useSyncThreadModelConfig() {
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  async function syncThreadModelConfigWrapper(options: SyncThreadModelConfigOptions): Promise<boolean> {
    const threadId = options.threadId ?? fromUUID<Id<"threads">>(params?.threadId);
    if (!threadId) return false;

    const [, error] = await enqueueThreadSave(threadId, () =>
      tryCatch(
        syncThreadModelConfig({
          threadId,
          model: options.model,
          modelParams: options.modelParams,
          expectedModel: options.expectedModel,
        }),
      ),
    );

    if (error) {
      console.error("[Chat] Failed to sync model config", error);
      options.onFailure?.();
      return false;
    }
    return true;
  }

  return { syncThreadModelConfig: syncThreadModelConfigWrapper };
}
