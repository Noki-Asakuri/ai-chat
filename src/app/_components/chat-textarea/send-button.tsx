import { useLocalStorage } from "@uidotdev/usehooks";
import { CheckIcon, ChevronDownIcon, SendHorizontalIcon, SquareIcon } from "lucide-react";
import * as React from "react";

import { ButtonWithTip } from "../ui/button";
import { Menu, MenuArrow } from "../ui/menu";

import { useChatRequest } from "@/lib/chat/send-chat-request";
import { STORAGE_KEY, type SendPreference } from "@/lib/chat/send-preference";
import { useChatStore } from "@/lib/chat/store";

export function ChatSendButton() {
  const { submitChatMessage, abortChatRequest } = useChatRequest();
  const isStreaming = useChatStore((state) =>
    state.hasActiveStream(state.messages.at(-1)?._id ?? ""),
  );

  const [open, setOpen] = React.useState(false);
  const [{ pref }, setSendPreference] = useLocalStorage<SendPreference>(STORAGE_KEY, {
    pref: "enter",
  });

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <div
        data-streaming={isStreaming}
        className="group flex h-9 items-center gap-2 overflow-hidden rounded-md border bg-card pl-3 data-[streaming=true]:border-destructive data-[streaming=true]:bg-destructive/60 data-[streaming=true]:pr-3"
      >
        <ButtonWithTip
          type="button"
          size="none"
          variant="none"
          title={isStreaming ? "Abort Request" : "Send Message"}
          className="flex h-full flex-1 cursor-pointer items-center gap-2 p-0"
          onClick={() => (isStreaming ? abortChatRequest() : submitChatMessage())}
        >
          {isStreaming ? (
            <SquareIcon className="size-4" />
          ) : (
            <SendHorizontalIcon className="-rotate-45 size-4" />
          )}

          <span>{isStreaming ? "Abort" : "Send"}</span>
        </ButtonWithTip>

        <Menu.Trigger
          type="button"
          className="h-9 rounded-none border-l group-data-[streaming=true]:hidden"
          title="Send Preferences"
          render={<ButtonWithTip delay={1000} side="top" variant="none" className="size-8" />}
        >
          <ChevronDownIcon className="size-4" />
        </Menu.Trigger>
      </div>

      <Menu.Portal>
        <Menu.Positioner className="outline-none" sideOffset={8} align="end" side="top">
          <Menu.Popup className="flex w-64 origin-[var(--transform-origin)] flex-col gap-1 rounded-md border bg-card p-1 text-card-foreground transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[starting-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <MenuArrow className="fill-card" />

            <div className="px-2 pt-1 pb-2 text-muted-foreground text-sm">Choose how to send</div>

            <Menu.Item
              className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => setSendPreference({ pref: "enter" })}
            >
              <span className="inline-flex size-4 items-center justify-center">
                {pref === "enter" ? <CheckIcon className="size-4" /> : null}
              </span>
              <span>Press Enter to send</span>
            </Menu.Item>

            <Menu.Item
              className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => setSendPreference({ pref: "ctrlEnter" })}
            >
              <span className="inline-flex size-4 items-center justify-center">
                {pref === "ctrlEnter" ? <CheckIcon className="size-4" /> : null}
              </span>
              <span>Press Ctrl + Enter to send</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
