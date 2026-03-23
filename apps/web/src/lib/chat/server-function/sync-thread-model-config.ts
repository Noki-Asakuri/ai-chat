import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useParams } from "@tanstack/react-router";
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
  const convexClient = useConvex();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  const { model, modelParams } = useConfigStore(
    useShallow((state) => ({
      model: state.model,
      modelParams: state.modelParams,
    })),
  );

  async function syncThreadModelConfig(options: SyncThreadModelConfigOptions = {}) {
    const resolvedThreadId = options.threadId ?? fromUUID<Id<"threads">>(params?.threadId);
    const latestModel = options.model ?? model;

    const latestModelParams: UpdateThreadModelConfigArgs["latestModelParams"] = {
      ...modelParams,
      ...options.modelParams,
      profile:
        options.modelParams?.profile === undefined
          ? modelParams.profile
          : options.modelParams.profile,
    };

    const [, error] = resolvedThreadId
      ? await tryCatch(
          convexClient.mutation(api.functions.threads.updateThreadModelConfig, {
            threadId: resolvedThreadId,
            latestModel,
            latestModelParams,
          }),
        )
      : await tryCatch(
          convexClient.mutation(api.functions.users.updateUserDefaultModelConfig, {
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
