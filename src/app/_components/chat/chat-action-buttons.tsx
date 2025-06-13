import { ToggleRightIcon, ToggleLeftIcon, GlobeIcon, BrainIcon } from "lucide-react";

import { ModelPicker } from "../model-picker";
import { ButtonWithTip } from "../ui/button";

import { ChatAttachmentButton } from "./chat-attachment-display";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ChatActionButtons() {
  const config = useChatStore((state) => state.chatConfig);
  const setChatConfig = useChatStore((state) => state.setChatConfig);

  return (
    <div className="flex items-center justify-center gap-2">
      <ModelPicker />

      <ButtonWithTip
        type="button"
        variant="secondary"
        className="size-9 border px-2 py-1.5 text-xs data-[active=true]:border-blue-400 data-[active=true]:bg-blue-500/15"
        data-active={config.webSearch}
        disabled={!getModelData(config.model)?.capabilities.webSearch}
        onMouseDown={() => setChatConfig({ webSearch: !config.webSearch })}
        title={config.webSearch ? "Disable Web Search" : "Enable Web Search"}
      >
        <GlobeIcon className={cn("transition-colors", { "stroke-blue-400": config.webSearch })} />
        <span className="sr-only">
          {config.webSearch ? "Disable Web Search" : "Enable Web Search"}
        </span>
      </ButtonWithTip>

      <ButtonWithTip
        type="button"
        variant="secondary"
        className="size-9 border px-2 py-1.5 text-xs data-[active=true]:border-yellow-400 data-[active=true]:bg-yellow-500/15"
        data-active={config.reasoning}
        disabled={!getModelData(config.model)?.capabilities.reasoning}
        onMouseDown={() => setChatConfig({ reasoning: !config.reasoning })}
        title={config.reasoning ? "Disable Reasoning" : "Enable Reasoning"}
      >
        <BrainIcon className={cn("transition-colors", { "stroke-yellow-400": config.reasoning })} />
        <span className="sr-only">
          {config.reasoning ? "Disable Reasoning" : "Enable Reasoning"}
        </span>
      </ButtonWithTip>

      <ChatAttachmentButton />
    </div>
  );
}
