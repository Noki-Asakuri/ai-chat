import {
  ArrowUpIcon,
  CheckIcon,
  CornerDownLeftIcon,
  Loader2Icon,
  SaveIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "@/components/ui/toast";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "../provider/config-provider";
import { ButtonWithTip } from "../ui/button";
import { Menu, MenuArrow } from "../ui/menu";

import type { SendPreference } from "@/lib/chat/send-preference";
import { useAbortChatStream } from "@/lib/chat/server-function/abort-chat-stream";
import { useSendChatMessage } from "@/lib/chat/server-function/send-chat-message";
import { useUpdateSendPreference } from "@/lib/chat/use-update-send-preference";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import { cn } from "@/lib/utils";

import { keepComposerFocus } from "./keep-composer-focus";

function useHandleSendPreferenceSelection() {
  const updateSendPreference = useUpdateSendPreference();

  return React.useCallback(
    function handleSendPreferenceSelection(nextPreference: SendPreference) {
      void (async function () {
        const error = await updateSendPreference(nextPreference);
        if (!error) return;

        toast.error("Failed to save send preference", {
          description: error.message,
        });
      })();
    },
    [updateSendPreference],
  );
}

const SEND_PREFERENCE_LABEL = {
  enter: "Press Enter to send",
  ctrlEnter: "Press Ctrl + Enter to send",
} as const satisfies Record<SendPreference, string>;

/** Small "Enter ↵" hint next to the send button that opens the send preference menu. */
function SendPreferenceHint({ disabled, className }: { disabled?: boolean; className?: string }) {
  const isMobile = useIsMobile();
  const pref = useConfigStore((state) => state.pref);
  const handleSendPreferenceSelection = useHandleSendPreferenceSelection();
  const [open, setOpen] = React.useState(false);

  if (isMobile) return null;

  return (
    <Menu.Root open={open} onOpenChange={(next) => (!disabled ? setOpen(next) : undefined)}>
      <Menu.Trigger
        type="button"
        disabled={disabled}
        aria-label={`Send preferences: ${SEND_PREFERENCE_LABEL[pref]}`}
        onMouseDown={keepComposerFocus}
        className={cn(
          "inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] leading-none text-muted-foreground/80 transition-colors outline-none hover:bg-foreground/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-expanded:bg-foreground/6 aria-expanded:text-foreground",
          className,
        )}
      >
        <span>{pref === "ctrlEnter" ? "Ctrl" : "Enter"}</span>
        <CornerDownLeftIcon aria-hidden="true" className="size-3" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner className="outline-none" sideOffset={8} align="end" side="top">
          <Menu.Popup className="flex w-64 origin-(--transform-origin) flex-col gap-1 rounded-md border bg-card p-1 text-card-foreground transition-[transform,scale,opacity] data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0">
            <MenuArrow className="fill-card" />

            <div className="px-2 pt-1 pb-2 text-sm text-muted-foreground">Choose how to send</div>

            {(["enter", "ctrlEnter"] as const).map((option) => (
              <Menu.Item
                key={option}
                className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleSendPreferenceSelection(option)}
              >
                <span className="inline-flex size-4 items-center justify-center">
                  {pref === option ? <CheckIcon className="size-4" /> : null}
                </span>
                <span>{SEND_PREFERENCE_LABEL[option]}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const sendButtonClassName =
  "size-9 shrink-0 cursor-pointer rounded-full p-0 transition-[background-color,color,scale] active:scale-94 motion-reduce:transition-none";

export function ChatSendButton() {
  const hasContent = useChatStore((state) => state.input.trim().length > 0 || state.attachments.length > 0);

  const { status, threadId } = useMessageStore(
    useShallow((state) => {
      const lastId = state.messageIds.at(-1);
      const lastMessage = lastId ? state.messagesById[lastId] : undefined;

      return {
        status: lastMessage?.status ?? "complete",
        threadId: lastMessage?.threadId ?? state.currentThreadId,
      };
    }),
  );

  const { abortChatStream } = useAbortChatStream();
  const { sendChatRequest } = useSendChatMessage();
  const isInFlight = status === "pending" || status === "streaming";

  async function handleSend() {
    if (isInFlight) {
      if (threadId) {
        await abortChatStream(threadId);
      }
      return;
    }

    await sendChatRequest();
  }

  return (
    <div className="flex items-center gap-1">
      {!isInFlight && <SendPreferenceHint />}

      <ButtonWithTip
        size="none"
        variant="none"
        title={isInFlight ? "Abort Request" : "Send Message"}
        data-streaming={isInFlight}
        data-empty={!isInFlight && !hasContent}
        className={cn(
          sendButtonClassName,
          "bg-primary text-primary-foreground hover:bg-primary/85",
          "data-[empty=true]:bg-foreground/10 data-[empty=true]:text-muted-foreground data-[empty=true]:hover:bg-foreground/15",
          "data-[streaming=true]:bg-foreground data-[streaming=true]:text-background data-[streaming=true]:hover:bg-foreground/85",
        )}
        onMouseDown={keepComposerFocus}
        onClick={handleSend}
      >
        {isInFlight ? (
          <SquareIcon className="size-3.5 fill-current" />
        ) : (
          <ArrowUpIcon className="size-4.5" strokeWidth={2.25} />
        )}
      </ButtonWithTip>
    </div>
  );
}

export type ChatEditSendButtonProps = {
  isSaving: boolean;
  onSave: () => void;
};

export function ChatEditSendButton({ isSaving, onSave }: ChatEditSendButtonProps) {
  return (
    <div className="ml-auto flex items-center gap-1">
      <SendPreferenceHint disabled={isSaving} />

      <ButtonWithTip
        type="button"
        size="none"
        variant="none"
        title="Cancel Editing"
        className="h-8 cursor-pointer gap-1.5 rounded-full px-3 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
        onClick={() => chatStoreActions.setEditMessage(null)}
        disabled={isSaving}
      >
        <XIcon className="size-4" />
        <span>Cancel</span>
      </ButtonWithTip>

      <ButtonWithTip
        type="button"
        size="none"
        variant="none"
        title={isSaving ? "Saving..." : "Save Changes"}
        className="h-8 cursor-pointer gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
        <span>{isSaving ? "Saving" : "Save"}</span>
      </ButtonWithTip>
    </div>
  );
}
