import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useParams } from "@tanstack/react-router";
import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex } from "convex/react";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";

import { fromUUID, tryCatch } from "@/lib/utils";

type UpdateThreadModelConfigArgs = (typeof api.functions.threads.updateThreadModelConfig)["_args"];

type SyncThreadModelConfigOptions = {
  threadId?: Id<"threads">;
  model?: UpdateThreadModelConfigArgs["latestModel"];
  modelParams?: Partial<UpdateThreadModelConfigArgs["latestModelParams"]>;
};

export function useSyncThreadModelConfig() {
  const [sessionId] = useSessionId();
  const convexClient = useConvex();
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });

  const { model, effort, webSearch, profile } = useConfigStore(
    useShallow((state) => ({
      model: state.model,
      effort: state.effort,
      webSearch: state.webSearch,
      profile: state.profile,
    })),
  );

  async function syncThreadModelConfig(options: SyncThreadModelConfigOptions = {}) {
    if (!sessionId) return;

    const resolvedThreadId = options.threadId ?? fromUUID<Id<"threads">>(params?.threadId);
    const latestModel = options.model ?? model;

    const latestModelParams: UpdateThreadModelConfigArgs["latestModelParams"] = {
      effort: options.modelParams?.effort ?? effort,
      webSearch: options.modelParams?.webSearch ?? webSearch,
      profile:
        options.modelParams?.profile === undefined
          ? (profile ?? null)
          : options.modelParams.profile,
    };

    const [, error] = resolvedThreadId
      ? await tryCatch(
          convexClient.mutation(api.functions.threads.updateThreadModelConfig, {
            sessionId,
            threadId: resolvedThreadId,
            latestModel,
            latestModelParams,
          }),
        )
      : await tryCatch(
          convexClient.mutation(api.functions.users.updateUserDefaultModelConfig, {
            sessionId,
            defaultModel: latestModel,
            modelParams: latestModelParams,
          }),
        );

    if (error) {
      console.error("[Chat] Failed to sync model config", error);
    }
  }

  return { syncThreadModelConfig };
}
