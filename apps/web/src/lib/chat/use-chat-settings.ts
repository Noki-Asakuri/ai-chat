import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useParams } from "@tanstack/react-router";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";

import { getDefaultReasoning, getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import { useSyncThreadModelConfig } from "@/lib/chat/server-function/sync-thread-model-config";
import { chatStoreActions } from "@/lib/store/chat-store";
import { threadStoreActions } from "@/lib/store/thread-store";
import type { ReasoningEffort } from "@/lib/types";

export function useChangeChatModel() {
  const { syncThreadModelConfig } = useSyncThreadModelConfig();
  const { effort, setConfig, setModelParams } = useConfigStore(
    useShallow((state) => ({
      effort: state.modelParams.effort,
      setConfig: state.setConfig,
      setModelParams: state.setModelParams,
    })),
  );

  return function changeChatModel(model: string): void {
    chatStoreActions.retainCompatibleAttachments(model);
    const modelData = tryGetModelData(model);
    const nextEffort =
      modelData && !getReasoningOptions(modelData).includes(effort) ? getDefaultReasoning(modelData) : effort;

    setConfig({ model });

    if (nextEffort !== effort) setModelParams({ effort: nextEffort });
    void syncThreadModelConfig({ model, modelParams: { effort: nextEffort } });
  };
}

export function useSetChatWebSearch() {
  const { syncThreadModelConfig } = useSyncThreadModelConfig();
  const { model, setModelParams } = useConfigStore(
    useShallow((state) => ({ model: state.model, setModelParams: state.setModelParams })),
  );

  return function setChatWebSearch(webSearch: boolean): void {
    setModelParams({ webSearch });
    void syncThreadModelConfig({ model, modelParams: { webSearch } });
  };
}

export function useSetChatEffort() {
  const { syncThreadModelConfig } = useSyncThreadModelConfig();
  const { model, setModelParams } = useConfigStore(
    useShallow((state) => ({ model: state.model, setModelParams: state.setModelParams })),
  );

  return function setChatEffort(effort: ReasoningEffort): void {
    setModelParams({ effort });
    void syncThreadModelConfig({ model, modelParams: { effort } });
  };
}

/** Choose the profile for this chat (null for none); a thread saves it so it sticks. */
export function useSetChatProfile() {
  const { syncThreadModelConfig } = useSyncThreadModelConfig();
  const chooseProfile = useConfigStore((state) => state.chooseProfile);
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  return function setChatProfile(profile: Id<"profiles"> | null): void {
    chooseProfile(profile);
    // A new chat has no thread to save it on yet, so keep it with the unsent draft.
    if (!params?.threadId) threadStoreActions.rememberNewChatProfile(profile);
    void syncThreadModelConfig({ modelParams: { profile } });
  };
}
