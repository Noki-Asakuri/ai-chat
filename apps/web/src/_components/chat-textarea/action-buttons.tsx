import { GlobeIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";
import { ButtonWithTip } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { BaseChatAttachmentsButton, ChatAttachmentsButton } from "./attachments-display";
import { ChatModelSelector, ModelSelector } from "./model-selector";
import { ChatReasoningPicker, ReasoningPicker } from "./reasoning-picker";

import { getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import { useSyncThreadModelConfig } from "@/lib/chat/server-function/sync-thread-model-config";
import { cn } from "@/lib/utils";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

export function ChatActionButtons() {
  const model = useConfigStore((state) => state.model);
  const modelData = tryGetModelData(model);

  const supportsReasoning = modelData ? getReasoningOptions(modelData).length > 0 : false;
  const supportToolCalling = modelData?.capabilities.toolCalling ?? false;
  const supportsAttachments =
    modelData?.modalities.input.some((modality) => modality === "image" || modality === "pdf") ?? false;

  return (
    <div className="flex items-center justify-center gap-2">
      <ChatModelSelector />
      {supportsReasoning && (
        <>
          <ActionButtonSeparator />
          <ChatReasoningPicker />
        </>
      )}

      {(supportToolCalling || supportsAttachments) && (
        <>
          <ActionButtonSeparator />

          {supportToolCalling && <WebSearchButton />}
          {supportsAttachments && <ChatAttachmentsButton />}
        </>
      )}
    </div>
  );
}

export function ChatEditActionButtons() {
  const editMessage = useChatStore((state) => state.editMessage);
  if (!editMessage) return null;

  const modelData = tryGetModelData(editMessage.model);
  const supportsReasoning = modelData ? getReasoningOptions(modelData).length > 0 : false;
  const supportsWebSearch = modelData?.capabilities.toolCalling ?? false;
  const supportsAttachments =
    modelData?.modalities.input.some((modality) => modality === "image" || modality === "pdf") ?? false;

  return (
    <div className="flex items-center justify-center gap-2">
      <ModelSelector
        value={editMessage.model}
        onChange={(model) => {
          chatStoreActions.retainCompatibleEditAttachments(model);
          chatStoreActions.updateEditMessage({ model });
        }}
        triggerId="button-edit-model-selector-trigger"
      />

      {supportsReasoning && (
        <>
          <ActionButtonSeparator />
          <ReasoningPicker
            model={editMessage.model}
            value={editMessage.modelParams.effort ?? "medium"}
            onChange={(effort) =>
              chatStoreActions.updateEditMessage({
                modelParams: { webSearch: editMessage.modelParams.webSearch, effort },
              })
            }
          />
        </>
      )}
      {supportsWebSearch && (
        <>
          <ActionButtonSeparator />
          <BaseWebSearchButton
            model={editMessage.model}
            webSearch={editMessage.modelParams.webSearch ?? false}
            setWebSearch={(value) =>
              chatStoreActions.updateEditMessage({
                modelParams: { webSearch: value, effort: editMessage.modelParams.effort },
              })
            }
          />
        </>
      )}
      {supportsAttachments && (
        <>
          <ActionButtonSeparator />
          <BaseChatAttachmentsButton
            model={editMessage.model}
            handleAddAttachments={(attachments) => {
              chatStoreActions.addEditAttachments(attachments);
            }}
          />
        </>
      )}
    </div>
  );
}

function ActionButtonSeparator() {
  return <Separator orientation="vertical" className="h-5 self-auto" />;
}

export function BaseWebSearchButton({
  model,
  webSearch,
  setWebSearch,
}: {
  model: string;
  webSearch: boolean;
  setWebSearch: (webSearch: boolean) => void;
}) {
  const canDoWebSearch = tryGetModelData(model)?.capabilities.toolCalling ?? false;

  return (
    <ButtonWithTip
      type="button"
      variant="ghost"
      hidden={!canDoWebSearch}
      data-active={webSearch}
      className="surface-edge size-9 cursor-pointer border border-border px-2 py-1.5 text-xs data-[active=true]:border-primary"
      onMouseDown={() => setWebSearch(!webSearch)}
      title={webSearch ? "Disable Web Search" : "Enable Web Search"}
    >
      <GlobeIcon className={cn("transition-colors", { "stroke-primary": webSearch })} />
      <span className="sr-only">{webSearch ? "Disable Web Search" : "Enable Web Search"}</span>
    </ButtonWithTip>
  );
}

function WebSearchButton() {
  const configStore = useConfigStoreState();
  const { syncThreadModelConfig } = useSyncThreadModelConfig();
  const config = useConfigStore(
    useShallow((state) => ({ webSearch: state.modelParams.webSearch, model: state.model })),
  );

  return (
    <BaseWebSearchButton
      model={config.model}
      webSearch={config.webSearch}
      setWebSearch={(webSearch) => {
        configStore.setModelParams({ webSearch });

        void syncThreadModelConfig({
          model: config.model,
          modelParams: { webSearch },
        });
      }}
    />
  );
}
