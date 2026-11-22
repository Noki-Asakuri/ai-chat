import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import {
  mergeThreadModelConfig,
  type ThreadModelConfigPatch,
  type ThreadModelParams,
} from "@ai-chat/shared/chat/thread-model-config";

import { useParams } from "@tanstack/react-router";
import type { OptimisticLocalStore } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import { useConvex } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { use, useCallback } from "react";

import { ConfigStoreContext } from "@/components/provider/config-provider";

import type { createConfigStore } from "@/lib/store/config-store";
import { fromUUID, tryCatch } from "@/lib/utils";

export type ModelConfigPatch = ThreadModelConfigPatch<Id<"profiles">>;

type UpdateThreadModelConfigArgs = FunctionArgs<typeof api.functions.threads.updateThreadModelConfig>;
type ThreadPageMeta = FunctionReturnType<typeof api.functions.threads.getThreadPageMeta>;

/**
 * Returns the thread meta with a model config update merged in, or null when the meta has no
 * full config to merge into (threads from before the backfill; the server recovers those).
 */
export function nextThreadPageMeta(
  meta: ThreadPageMeta,
  args: UpdateThreadModelConfigArgs,
): ThreadPageMeta | null {
  const storedParams: Partial<ThreadModelParams<Id<"profiles">>> | undefined = meta.latestModelParams;
  if (storedParams?.effort === undefined || storedParams.webSearch === undefined) return null;

  const next = mergeThreadModelConfig(
    {
      model: meta.latestModel,
      params: {
        effort: storedParams.effort,
        webSearch: storedParams.webSearch,
        profile: storedParams.profile ?? null,
      },
    },
    { model: args.latestModel, params: args.latestModelParams },
  );
  return { ...meta, latestModel: next.model, latestModelParams: next.params };
}

/** Applies a model config update to the thread's cached `getThreadPageMeta` result. */
function applyModelConfigOptimistically(store: OptimisticLocalStore, args: UpdateThreadModelConfigArgs) {
  const query = api.functions.threads.getThreadPageMeta;
  const meta = store.getQuery(query, { threadId: args.threadId });
  const next = meta ? nextThreadPageMeta(meta, args) : null;
  if (next) store.setQuery(query, { threadId: args.threadId }, next);
}

type ConfigStoreApi = ReturnType<typeof createConfigStore>;

/**
 * Changes the composer's model settings. Pass only what changed.
 *
 * In a thread, the thread's `getThreadPageMeta` result is the only source of these settings: the
 * change is saved with `updateThreadModelConfig`, and its optimistic update applies the same merge
 * to that result, which the provider copies into the store. Convex sends one client's mutations in
 * order, keeps each optimistic result until the server reflects it and rolls it back on failure, so
 * the composer never shows an older value over a newer choice, nor a change that failed to save.
 *
 * Without a thread (the welcome page), there is nothing to save and the store is changed directly.
 */
export function saveModelConfig(options: {
  convex: Pick<ConvexReactClient, "mutation">;
  configStore: ConfigStoreApi | null;
  threadId: Id<"threads"> | null | undefined;
  patch: ModelConfigPatch;
}) {
  const { convex, configStore, threadId, patch } = options;

  if (!threadId) {
    if (!configStore) return;
    const state = configStore.getState();
    const next = mergeThreadModelConfig({ model: state.model, params: state.modelParams }, patch);
    state.setConfig({ model: next.model });
    state.setModelParams(next.params);
    return;
  }

  void tryCatch(
    convex.mutation(
      api.functions.threads.updateThreadModelConfig,
      { threadId, latestModel: patch.model, latestModelParams: patch.params },
      { optimisticUpdate: applyModelConfigOptimistically },
    ),
  ).then(([, error]) => {
    if (error) console.error("[Chat] Failed to save model settings", error);
    return error;
  });
}

/** `saveModelConfig` for the current route's thread and config store. */
export function useUpdateModelConfig() {
  const convex = useConvex();
  const configStore = use(ConfigStoreContext);
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  return useCallback(
    (patch: ModelConfigPatch) => saveModelConfig({ convex, configStore, threadId, patch }),
    [convex, configStore, threadId],
  );
}
