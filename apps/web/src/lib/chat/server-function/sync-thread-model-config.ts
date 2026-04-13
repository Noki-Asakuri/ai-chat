import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useParams } from "@tanstack/react-router";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";

import { syncThreadModelConfig } from "@/lib/trpc/client";
import { fromUUID, tryCatch } from "@/lib/utils";

type SyncThreadModelConfigOptions = {
  threadId?: Id<"threads">;
  model?: string;
  modelParams?: Partial<{
    webSearch: boolean;
    effort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
    profile?: Id<"profiles"> | null;
  }>;
};

export function useSyncThreadModelConfig() {
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  const { model, modelParams } = useConfigStore(
    useShallow((state) => ({
      model: state.model,
      modelParams: state.modelParams,
    })),
  );

  async function syncThreadModelConfig(options: SyncThreadModelConfigOptions = {}) {
    const resolvedThreadId = options.threadId ?? fromUUID<Id<"threads">>(params?.threadId);
    const nextModel = options.model ?? model;

    const nextModelParams = {
      ...modelParams,
      ...options.modelParams,
      profile:
        options.modelParams?.profile === undefined
          ? modelParams.profile
          : options.modelParams.profile,
    };

    const [, error] = await tryCatch(
      syncThreadModelConfig({
        threadId: resolvedThreadId,
        model: nextModel,
        modelParams: nextModelParams,
      }),
    );

    if (error) {
      console.error("[Chat] Failed to sync model config", error);
    }
  }

  return { syncThreadModelConfig };
}
