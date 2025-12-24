import { GlobeIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";
import { ButtonWithTip } from "@/components/ui/button";

import { BaseChatAttachmentsButton, ChatAttachmentsButton } from "./attachments-display";
import { ChatEffortSelector, EffortSelector } from "./effort-selector";
import { ChatModelSelector, ModelSelector } from "./model-selector";

import { getModelData } from "@/lib/chat/models";
import { cn } from "@/lib/utils";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

export function ChatActionButtons() {
  return (
    <div className="flex items-center justify-center gap-2">
      <ChatModelSelector />
      <ChatEffortSelector />

      <WebSearchButton />
      <ChatAttachmentsButton />
    </div>
  );
}

export function ChatEditActionButtons() {
  const editMessage = useChatStore((state) => state.editMessage);
  if (!editMessage) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <ModelSelector
        value={editMessage.model}
        onChange={(model) => chatStoreActions.updateEditMessage({ model })}
        triggerId="button-edit-model-selector-trigger"
      />

      <EffortSelector
        model={editMessage.model}
        value={editMessage.modelParams.effort ?? "medium"}
        onChange={(effort) =>
          chatStoreActions.updateEditMessage({
            modelParams: { webSearch: editMessage.modelParams.webSearch, effort },
          })
        }
      />

      <BaseWebSearchButton
        model={editMessage.model}
        webSearch={editMessage.modelParams.webSearch ?? false}
        setWebSearch={(value) =>
          chatStoreActions.updateEditMessage({
            modelParams: { webSearch: value, effort: editMessage.modelParams.effort },
          })
        }
      />

      <BaseChatAttachmentsButton
        model={editMessage.model}
        handleAddAttachments={(attachments) => {
          chatStoreActions.addEditAttachments(attachments);
        }}
      />
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
  const canDoWebSearch = getModelData(model)?.capabilities.webSearch ?? false;

  return (
    <ButtonWithTip
      type="button"
      variant="ghost"
      hidden={!canDoWebSearch}
      data-active={webSearch}
      className="size-9 cursor-pointer border border-border px-2 py-1.5 text-xs data-[active=true]:border-blue-400"
      onMouseDown={() => setWebSearch(!webSearch)}
      title={webSearch ? "Disable Web Search" : "Enable Web Search"}
    >
      <GlobeIcon className={cn("transition-colors", { "stroke-blue-400": webSearch })} />
      <span className="sr-only">{webSearch ? "Disable Web Search" : "Enable Web Search"}</span>
    </ButtonWithTip>
  );
}

function WebSearchButton() {
  const configStore = useConfigStoreState();
  const config = useConfigStore(
    useShallow((state) => ({ webSearch: state.webSearch, model: state.model })),
  );

  return (
    <BaseWebSearchButton
      model={config.model}
      webSearch={config.webSearch}
      setWebSearch={(webSearch) => configStore.setConfig({ webSearch })}
    />
  );
}
