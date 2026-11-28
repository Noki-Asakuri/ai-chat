import { GlobeIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";
import { ButtonWithTip } from "@/components/ui/button";

import { BaseChatAttachmentsButton } from "./attachments-display";
import { composerControlClassName } from "./composer-control";
import { ChatModelSelector, ModelSelector } from "./model-selector";
import { keepComposerFocus } from "./keep-composer-focus";
import { ChatReasoningPicker, ReasoningPicker } from "./reasoning-picker";

import { getDefaultReasoning, getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import { useSetChatWebSearch } from "@/lib/chat/use-chat-settings";
import { cn } from "@/lib/utils";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

export function ChatActionButtons() {
  const model = useConfigStore((state) => state.model);
  const modelData = tryGetModelData(model);

  const supportsReasoning = modelData ? getReasoningOptions(modelData).length > 0 : false;
  const supportToolCalling = modelData?.capabilities.toolCalling ?? false;

  return (
    <div className="flex min-w-0 flex-1 items-center justify-start gap-0.5">
      <ChatModelSelector />

      <div className="hidden items-center gap-0.5 sm:flex">
        {supportsReasoning && <ChatReasoningPicker />}
        {supportToolCalling && <WebSearchButton />}
      </div>
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
    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-0.5">
      {supportsAttachments && (
        <BaseChatAttachmentsButton
          model={editMessage.model}
          handleAddAttachments={(attachments) => {
            chatStoreActions.addEditAttachments(attachments);
          }}
        />
      )}
      <ModelSelector
        value={editMessage.model}
        onChange={(model) => {
          const nextModelData = tryGetModelData(model);
          const currentEffort = editMessage.modelParams.effort ?? "medium";
          const effort =
            nextModelData && !getReasoningOptions(nextModelData).includes(currentEffort)
              ? getDefaultReasoning(nextModelData)
              : currentEffort;
          chatStoreActions.retainCompatibleEditAttachments(model);
          chatStoreActions.updateEditMessage({
            model,
            modelParams: { ...editMessage.modelParams, effort },
          });
        }}
        triggerId="button-edit-model-selector-trigger"
        className="max-w-full shrink"
      />

      {supportsReasoning && (
        <ReasoningPicker
          model={editMessage.model}
          value={editMessage.modelParams.effort ?? "medium"}
          onChange={(effort) =>
            chatStoreActions.updateEditMessage({
              modelParams: { webSearch: editMessage.modelParams.webSearch, effort },
            })
          }
        />
      )}
      {supportsWebSearch && (
        <BaseWebSearchButton
          model={editMessage.model}
          webSearch={editMessage.modelParams.webSearch ?? false}
          setWebSearch={(value) =>
            chatStoreActions.updateEditMessage({
              modelParams: { webSearch: value, effort: editMessage.modelParams.effort },
            })
          }
        />
      )}
    </div>
  );
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
      aria-pressed={webSearch}
      className={cn(
        composerControlClassName,
        "data-[active=true]:bg-primary/14 data-[active=true]:text-primary data-[active=true]:hover:bg-primary/20",
      )}
      onMouseDown={keepComposerFocus}
      onClick={() => setWebSearch(!webSearch)}
      title={webSearch ? "Disable Web Search" : "Enable Web Search"}
    >
      <GlobeIcon />
      <span aria-hidden="true" className="hidden sm:inline">
        Search
      </span>
    </ButtonWithTip>
  );
}

function WebSearchButton() {
  const setChatWebSearch = useSetChatWebSearch();
  const config = useConfigStore(
    useShallow((state) => ({ webSearch: state.modelParams.webSearch, model: state.model })),
  );

  return (
    <BaseWebSearchButton model={config.model} webSearch={config.webSearch} setWebSearch={setChatWebSearch} />
  );
}
