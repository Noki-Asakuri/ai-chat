import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import {
  applyThreadModelConfigPatch,
  readStoredThreadModelConfig,
} from "@ai-chat/shared/chat/thread-model-config";

import { useQuery } from "@tanstack/react-query";
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
  // An empty patch resolves the stored effort for the stored model, as the server does on save.
  return applyThreadModelConfigPatch(
    readStoredThreadModelConfig(meta.latestModel, meta.latestModelParams),
    {},
  );
}

/** Applies a settings save to the cached thread page meta right away. Convex undoes it if the save fails. */
export const optimisticallyUpdateThreadModelConfig: OptimisticUpdate<UpdateArgs> = (
  localStore,
  { threadId, ...patch },
) => {
  const meta = localStore.getQuery(api.functions.threads.getThreadPageMeta, { threadId });
  if (!meta) return;

  const next = applyThreadModelConfigPatch(toComposerModelConfig(meta), patch);
  localStore.setQuery(
    api.functions.threads.getThreadPageMeta,
    { threadId },
    { ...meta, latestModel: next.model, latestModelParams: next.modelParams },
  );
};

/**
 * Saves only the given settings for a thread. Convex runs a client's mutations in order, so a save
 * can't be overwritten by an earlier one that lands later, and on failure the optimistic value is
 * dropped and the composer shows the saved value again.
 */
export async function saveThreadModelConfig(
  convex: ConvexReactClient,
  threadId: Id<"threads">,
  patch: ComposerModelConfigPatch,
) {
  const [, error] = await tryCatch(
    convex.mutation(
      api.functions.threads.updateThreadModelConfig,
      { threadId, ...patch },
      { optimisticUpdate: optimisticallyUpdateThreadModelConfig },
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
  const { data: meta } = useQuery(
    convexQuery(api.functions.threads.getThreadPageMeta, threadId ? { threadId } : "skip"),
  );
  const threadConfig = useMemo(() => (meta ? toComposerModelConfig(meta) : null), [meta]);

  function read(): ComposerModelConfig {
    const fallback = storeApi.getState().newThread;
    if (!threadId) return fallback;
    return readThreadModelConfig(convex, threadId) ?? fallback;
  }

  async function update(patch: ComposerModelConfigPatch) {
    if (!threadId) {
      storeApi.getState().updateNewThread(patch);
      return;
    }
    await saveThreadModelConfig(convex, threadId, patch);
  }

  return { threadId, config: threadConfig ?? newThread, read, update };
}
