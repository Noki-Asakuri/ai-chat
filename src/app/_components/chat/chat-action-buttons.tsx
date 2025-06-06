import { ToggleRightIcon, ToggleLeftIcon } from "lucide-react";

import { ModelPicker } from "../model-picker";
import { ButtonWithTip } from "../ui/button";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";

export function ChatActionButtons() {
  const config = useChatStore((state) => state.chatConfig);
  const setChatConfig = useChatStore((state) => state.setChatConfig);

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <ModelPicker />

      <ButtonWithTip
        type="button"
        variant="secondary"
        className="data-[active=true]:border-primary data-[active=true]:bg-primary/40 h-max cursor-pointer border px-2 py-1.5 text-xs"
        data-active={config.webSearch}
        disabled={!getModelData(config.model).capabilities.webSearch}
        onMouseDown={() => setChatConfig({ webSearch: !config.webSearch })}
        title={config.webSearch ? "Disable Web Search" : "Enable Web Search"}
      >
        {config.webSearch ? <ToggleRightIcon /> : <ToggleLeftIcon />}
        Web Search
      </ButtonWithTip>

      <ButtonWithTip
        type="button"
        variant="secondary"
        className="data-[active=true]:border-primary data-[active=true]:bg-primary/40 h-max cursor-pointer border px-2 py-1.5 text-xs"
        data-active={config.reasoning}
        disabled={!getModelData(config.model).capabilities.reasoning}
        onMouseDown={() => setChatConfig({ reasoning: !config.reasoning })}
        title={config.reasoning ? "Disable Reasoning" : "Enable Reasoning"}
      >
        {config.reasoning ? <ToggleRightIcon /> : <ToggleLeftIcon />}
        Reasoning
      </ButtonWithTip>
    </div>
  );
}
