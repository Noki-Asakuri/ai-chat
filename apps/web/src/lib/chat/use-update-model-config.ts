import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import {
  mergeThreadModelConfig,
  type ThreadModelConfigPatch,
  type ThreadModelParams,
} from "@ai-chat/shared/chat/thread-model-config";

import { useParams } from "@tanstack/react-router";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { use, useCallback } from "react";

import { ConfigStoreContext } from "@/components/provider/config-provider";

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

/**
 * Returns a function that changes the composer's model settings. Pass only what changed.
 *
 * The local store updates at once. In a thread, the change is also saved with the
 * `updateThreadModelConfig` mutation, whose optimistic update applies the same merge to the
 * thread's `getThreadPageMeta` result. Convex sends one client's mutations in order and keeps
 * their optimistic results until the server reflects them, so the provider never sees an older
 * value replace a newer choice; a failed save rolls back and the provider restores the server value.
 */
export function useUpdateModelConfig() {
  const configStore = use(ConfigStoreContext);
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const updateThreadModelConfig = useMutation(
    api.functions.threads.updateThreadModelConfig,
  ).withOptimisticUpdate(applyModelConfigOptimistically);

  return useCallback(
    function updateModelConfig(patch: ModelConfigPatch) {
      if (configStore) {
        const state = configStore.getState();
        const next = mergeThreadModelConfig({ model: state.model, params: state.modelParams }, patch);
        state.setConfig({ model: next.model });
        state.setModelParams(next.params);
      }

      if (!threadId) return;

      void tryCatch(
        updateThreadModelConfig({ threadId, latestModel: patch.model, latestModelParams: patch.params }),
      ).then(([, error]) => {
        if (error) console.error("[Chat] Failed to save model settings", error);
        return error;
      });
    },
    [configStore, threadId, updateThreadModelConfig],
  );
}
