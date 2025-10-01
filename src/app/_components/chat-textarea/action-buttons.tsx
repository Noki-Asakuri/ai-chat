import { GlobeIcon } from "lucide-react";

import { ButtonWithTip } from "../ui/button";

import { ChatAttachmentButton } from "./attachment-display";
import { ChatEffortSelector } from "./effort-selector";
import { ChatModelSelector } from "./model-selector";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ChatActionButtons() {
  return (
    <div className="flex items-center justify-center gap-2">
      <ChatModelSelector />
      <ChatEffortSelector />

      <WebSearchButton />
      <ChatAttachmentButton />
    </div>
  );
}

function WebSearchButton() {
  const config = useChatStore((state) => state.chatConfig);
  const setChatConfig = useChatStore((state) => state.setChatConfig);

  return (
    <ButtonWithTip
      type="button"
      variant="ghost"
      data-active={config.webSearch}
      className="size-9 cursor-pointer border px-2 py-1.5 text-xs data-[active=true]:border-blue-400"
      hidden={!getModelData(config.model)?.capabilities.webSearch}
      onMouseDown={() => setChatConfig({ webSearch: !config.webSearch })}
      title={config.webSearch ? "Disable Web Search" : "Enable Web Search"}
    >
      <GlobeIcon className={cn("transition-colors", { "stroke-blue-400": config.webSearch })} />
      <span className="sr-only">
        {config.webSearch ? "Disable Web Search" : "Enable Web Search"}
      </span>
    </ButtonWithTip>
  );
}
