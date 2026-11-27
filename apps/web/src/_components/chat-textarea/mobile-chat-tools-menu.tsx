import { BrainIcon, GlobeIcon, SlidersHorizontalIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { REASONING_OPTIONS } from "./reasoning-options";

import { getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import { useSetChatEffort, useSetChatWebSearch } from "@/lib/chat/use-chat-settings";
import type { ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Effort and web search for phones. Attaching a file has its own button next to the input. */
export function MobileChatToolsMenu({ className }: { className?: string }) {
  const config = useConfigStore(
    useShallow((state) => ({
      effort: state.modelParams.effort,
      model: state.model,
      webSearch: state.modelParams.webSearch,
    })),
  );
  const setChatEffort = useSetChatEffort();
  const setChatWebSearch = useSetChatWebSearch();

  const modelData = tryGetModelData(config.model);
  const reasoningOptions = modelData ? getReasoningOptions(modelData) : [];
  const supportsWebSearch = modelData?.capabilities.toolCalling ?? false;

  if (reasoningOptions.length === 0 && !supportsWebSearch) return null;

  function handleEffortChange(effort: ReasoningEffort) {
    setChatEffort(effort);
  }

  function handleWebSearchChange() {
    setChatWebSearch(!config.webSearch);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className={cn("surface-edge border border-border sm:hidden", className)}
            aria-label="Chat tools"
            title="Chat tools"
          >
            <SlidersHorizontalIcon />
          </Button>
        }
      />

      <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-52">
        <DropdownMenuGroup>
          {reasoningOptions.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <BrainIcon />
                <span className="flex-1">Effort</span>
                <span className="text-muted-foreground capitalize">
                  {REASONING_OPTIONS[config.effort].label}
                </span>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent side="left" align="end" sideOffset={4} className="w-36">
                <DropdownMenuRadioGroup value={config.effort}>
                  {reasoningOptions.map((effort) => (
                    <DropdownMenuRadioItem
                      key={effort}
                      value={effort}
                      closeOnClick={false}
                      onClick={() => handleEffortChange(effort)}
                    >
                      {REASONING_OPTIONS[effort].label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {supportsWebSearch && (
            <DropdownMenuItem closeOnClick={false} onClick={handleWebSearchChange}>
              <GlobeIcon />
              <span>Web search</span>
              <span className="ml-auto text-muted-foreground">{config.webSearch ? "On" : "Off"}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
