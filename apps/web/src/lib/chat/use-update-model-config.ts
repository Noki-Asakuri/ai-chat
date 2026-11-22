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
  const storedModel: string | undefined = meta.latestModel;
  const storedParams: Partial<ThreadModelParams<Id<"profiles">>> | undefined = meta.latestModelParams;
  // An empty model is unusable too; the server recovers it like a missing one.
  if (!storedModel || storedParams?.effort === undefined || storedParams.webSearch === undefined) {
    return null;
  }

  const next = mergeThreadModelConfig(
    {
      model: storedModel,
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

/**
 * Applies a model config update to the thread's cached `getThreadPageMeta` result. Returns whether
 * there was a result to update.
 */
function applyModelConfigOptimistically(store: OptimisticLocalStore, args: UpdateThreadModelConfigArgs) {
  const query = api.functions.threads.getThreadPageMeta;
  const meta = store.getQuery(query, { threadId: args.threadId });
  const next = meta ? nextThreadPageMeta(meta, args) : null;
  if (next) store.setQuery(query, { threadId: args.threadId }, next);
  return next !== null;
}

type ConfigStoreApi = ReturnType<typeof createConfigStore>;

/**
 * Applies `patch` to the store and returns a function that undoes it, if the store still holds
 * the values it set (a later change is left alone).
 */
function applyLocally(configStore: ConfigStoreApi, patch: ModelConfigPatch) {
  const state = configStore.getState();
  const previous = { model: state.model, params: state.modelParams };
  const next = mergeThreadModelConfig(previous, patch);
  state.setConfig({ model: next.model });
  state.setModelParams(next.params);

  return function undo() {
    const current = configStore.getState();
    if (current.model === next.model) current.setConfig({ model: previous.model });
    const params = current.modelParams;
    current.setModelParams({
      effort: params.effort === next.params.effort ? previous.params.effort : params.effort,
      webSearch: params.webSearch === next.params.webSearch ? previous.params.webSearch : params.webSearch,
      profile: params.profile === next.params.profile ? previous.params.profile : params.profile,
    });
  };
}

/**
 * Changes the composer's model settings. Pass only what changed.
 *
 * In a thread, the thread's `getThreadPageMeta` result is the source of these settings: the change
 * is saved with `updateThreadModelConfig`, and its optimistic update applies the same merge to that
 * result, which the provider copies into the store. Convex sends one client's mutations in order,
 * keeps each optimistic result until the server reflects it and rolls it back on failure, so the
 * composer never shows an older value over a newer choice, nor a change that failed to save.
 *
 * Convex runs the optimistic update synchronously inside `mutation()`. When it has nothing to apply
 * to (the thread's result hasn't arrived yet, or lacks a config), the store is changed directly so
 * the composer and the next send use the change, and that is undone if the save fails.
 *
 * Without a thread (the welcome page), there is nothing to save and the store is changed directly.
 * `onFailure` runs when the save fails, after the settings are rolled back.
 */
export function saveModelConfig(options: {
  convex: Pick<ConvexReactClient, "mutation">;
  configStore: ConfigStoreApi | null;
  threadId: Id<"threads"> | null | undefined;
  patch: ModelConfigPatch;
  onFailure?: () => void;
}) {
  const { convex, configStore, threadId, patch, onFailure } = options;

  if (!threadId) {
    if (configStore) applyLocally(configStore, patch);
    return;
  }

  let appliedOptimistically = false;
  const saving = convex.mutation(
    api.functions.threads.updateThreadModelConfig,
    { threadId, latestModel: patch.model, latestModelParams: patch.params },
    {
      optimisticUpdate: (store, args) => {
        if (applyModelConfigOptimistically(store, args)) appliedOptimistically = true;
      },
    },
  );
  const undoLocal = !appliedOptimistically && configStore ? applyLocally(configStore, patch) : null;

  void tryCatch(saving).then(([, error]) => {
    if (error) {
      console.error("[Chat] Failed to save model settings", error);
      undoLocal?.();
      onFailure?.();
    }
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
    (patch: ModelConfigPatch, callbacks: { onFailure?: () => void } = {}) =>
      saveModelConfig({ convex, configStore, threadId, patch, onFailure: callbacks.onFailure }),
    [convex, configStore, threadId],
  );
}
