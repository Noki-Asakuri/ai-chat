import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import {
  applyThreadModelConfigPatch,
  readStoredThreadModelConfig,
} from "@ai-chat/shared/chat/thread-model-config";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";
import type { OptimisticUpdate } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import { useConvex } from "convex/react";
import { useMemo } from "react";

import { useConfigStore, useConfigStoreApi } from "@/components/provider/config-provider";
import { toast } from "@/components/ui/toast";

import type { ComposerModelConfig, ComposerModelConfigPatch } from "@/lib/store/config-store";
import { fromUUID, tryCatch } from "@/lib/utils";

type ThreadPageMeta = (typeof api.functions.threads.getThreadPageMeta)["_returnType"];
type UpdateArgs = (typeof api.functions.threads.updateThreadModelConfig)["_args"];

function toComposerModelConfig(meta: ThreadPageMeta): ComposerModelConfig {
  return readStoredThreadModelConfig(meta.latestModel, meta.latestModelParams);
}

function threadPageMetaQuery(threadId: Id<"threads"> | undefined) {
  return convexQuery(api.functions.threads.getThreadPageMeta, threadId ? { threadId } : "skip");
}

/**
 * Applies a settings save to the cached thread page meta right away. Convex undoes it if the save fails.
 *
 * Before the Convex subscription delivers its first result, the composer shows the route's prefetched
 * meta (`base`). The update then starts from that, so the change shows and is readable at once; Convex
 * replays the update over the server's result when it arrives.
 */
export function optimisticThreadModelConfigUpdate(base?: ThreadPageMeta): OptimisticUpdate<UpdateArgs> {
  return (localStore, { threadId, ...patch }) => {
    const meta = localStore.getQuery(api.functions.threads.getThreadPageMeta, { threadId }) ?? base;
    if (!meta) return;

    const next = applyThreadModelConfigPatch(toComposerModelConfig(meta), patch);
    localStore.setQuery(
      api.functions.threads.getThreadPageMeta,
      { threadId },
      { ...meta, latestModel: next.model, latestModelParams: next.modelParams },
    );
  };
}

/**
 * Saves only the given settings for a thread. Convex runs a client's mutations in order, so a save
 * can't be overwritten by an earlier one that lands later, and on failure the optimistic value is
 * dropped and the composer shows the saved value again.
 */
export async function saveThreadModelConfig(
  convex: ConvexReactClient,
  threadId: Id<"threads">,
  patch: ComposerModelConfigPatch,
  prefetched?: ThreadPageMeta,
) {
  const [, error] = await tryCatch(
    convex.mutation(
      api.functions.threads.updateThreadModelConfig,
      { threadId, ...patch },
      { optimisticUpdate: optimisticThreadModelConfigUpdate(prefetched) },
    ),
  );

  if (error) {
    console.error("[Chat] Failed to save model settings", error);
    toast.error("Couldn't save model settings", { description: error.message });
  }
}

/** The thread's settings in the Convex client's local cache, including saves still in flight. */
export function readThreadModelConfig(
  convex: ConvexReactClient,
  threadId: Id<"threads">,
): ComposerModelConfig | null {
  try {
    const meta = convex.watchQuery(api.functions.threads.getThreadPageMeta, { threadId }).localQueryResult();
    return meta ? toComposerModelConfig(meta) : null;
  } catch {
    return null;
  }
}

/**
 * The composer's model settings. In a thread they come only from Convex (`getThreadPageMeta`); on the
 * welcome page they live in the config store until the first message creates the thread.
 *
 * - `config` is what the composer shows.
 * - `read()` returns the latest value at once, ahead of React rendering it. Use it when acting on the
 *   current value (sending, toggling).
 * - `update(patch)` changes only the given settings.
 */
export function useComposerModelConfig() {
  const convex = useConvex();
  const storeApi = useConfigStoreApi();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  // On a thread page this holds the account defaults, shown until the thread's settings load.
  const newThread = useConfigStore((state) => state.newThread);
  const queryClient = useQueryClient();
  const { data: meta } = useQuery(threadPageMetaQuery(threadId));
  const threadConfig = useMemo(() => (meta ? toComposerModelConfig(meta) : null), [meta]);

  // The route's prefetched meta, which the composer shows until the Convex subscription delivers.
  function prefetched(id: Id<"threads">) {
    return queryClient.getQueryData<ThreadPageMeta>(threadPageMetaQuery(id).queryKey);
  }

  function read(): ComposerModelConfig {
    const fallback = storeApi.getState().newThread;
    if (!threadId) return fallback;

    // Convex's cache holds saves still in flight, also those made before its first result.
    const cached = prefetched(threadId);
    return readThreadModelConfig(convex, threadId) ?? (cached ? toComposerModelConfig(cached) : fallback);
  }

  async function update(patch: ComposerModelConfigPatch) {
    if (!threadId) {
      storeApi.getState().updateNewThread(patch);
      return;
    }
    await saveThreadModelConfig(convex, threadId, patch, prefetched(threadId));
  }

  return { threadId, config: threadConfig ?? newThread, read, update };
}
