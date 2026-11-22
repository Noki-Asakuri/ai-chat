import { BrainIcon, GlobeIcon, PaperclipIcon, SlidersHorizontalIcon } from "lucide-react";
import { useRef } from "react";
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

import { useChatAttachmentInput } from "./use-chat-attachment-input";
import { REASONING_OPTIONS } from "./reasoning-options";

import { getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import { useUpdateModelConfig } from "@/lib/chat/use-update-model-config";
import { chatStoreActions } from "@/lib/store/chat-store";
import type { ReasoningEffort } from "@/lib/types";

export function MobileChatToolsMenu() {
  const inputRef = useRef<HTMLInputElement>(null);
  const updateModelConfig = useUpdateModelConfig();
  const config = useConfigStore(
    useShallow((state) => ({
      effort: state.modelParams.effort,
      model: state.model,
      webSearch: state.modelParams.webSearch,
    })),
  );
  const { accept, handleChange, supportsAttachments } = useChatAttachmentInput({
    model: config.model,
    handleAddAttachments: chatStoreActions.addAttachments,
  });

  const modelData = tryGetModelData(config.model);
  const reasoningOptions = modelData ? getReasoningOptions(modelData) : [];
  const supportsWebSearch = modelData?.capabilities.toolCalling ?? false;

  if (reasoningOptions.length === 0 && !supportsWebSearch && !supportsAttachments) return null;

  function handleEffortChange(effort: ReasoningEffort) {
    updateModelConfig({ params: { effort } });
  }

  function handleWebSearchChange() {
    updateModelConfig({ params: { webSearch: !config.webSearch } });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              className="surface-edge border border-border sm:hidden"
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

            {supportsAttachments && (
              <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                <PaperclipIcon />
                <span>Attachment</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {supportsAttachments && (
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
      )}
    </>
  );
}
