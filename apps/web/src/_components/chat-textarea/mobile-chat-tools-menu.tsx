import { BrainIcon, GlobeIcon, SlidersHorizontalIcon, UserRoundIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
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

import { composerIconControlClassName } from "./composer-control";
import { useChatProfile } from "./profile-picker";
import { REASONING_OPTIONS } from "./reasoning-options";

import { getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import { useSetChatEffort, useSetChatProfile, useSetChatWebSearch } from "@/lib/chat/use-chat-settings";
import type { ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Profile, effort and web search for phones. Attaching a file has its own button next to the input. */
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
  const setChatProfile = useSetChatProfile();
  const { library, profile, defaultProfileId } = useChatProfile();
  const profiles = library?.profiles ?? [];

  const modelData = tryGetModelData(config.model);
  const reasoningOptions = modelData ? getReasoningOptions(modelData) : [];
  const supportsWebSearch = modelData?.capabilities.toolCalling ?? false;

  if (reasoningOptions.length === 0 && !supportsWebSearch && profiles.length === 0) return null;

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
            size="none"
            className={cn(composerIconControlClassName, "sm:hidden", className)}
            aria-label="Chat tools"
            title="Chat tools"
          >
            <SlidersHorizontalIcon />
          </Button>
        }
      />

      <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-52">
        <DropdownMenuGroup>
          {profiles.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserRoundIcon />
                <span className="flex-1">Profile</span>
                <span className="max-w-24 truncate text-muted-foreground">{profile?.name ?? "None"}</span>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent side="left" align="end" sideOffset={4} className="max-h-80 w-56">
                <DropdownMenuRadioGroup value={profile?._id ?? "none"}>
                  <DropdownMenuRadioItem value="none" closeOnClick onClick={() => setChatProfile(null)}>
                    No profile
                  </DropdownMenuRadioItem>
                  {profiles.map((item) => (
                    <DropdownMenuRadioItem
                      key={item._id}
                      value={item._id}
                      closeOnClick
                      onClick={() => setChatProfile(item._id)}
                    >
                      <ProfileAvatar
                        name={item.name}
                        imageKey={item.imageKey}
                        className="size-5"
                        fallbackClassName="text-[9px]"
                      />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      {item._id === defaultProfileId && (
                        <span className="text-[10px] text-muted-foreground">Default</span>
                      )}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

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
