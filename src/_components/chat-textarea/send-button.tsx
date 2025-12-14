import {
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  SaveIcon,
  SendHorizontalIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";

import { useSessionId } from "convex-helpers/react/sessions";

import { useConfigStore, useConfigStoreState } from "../provider/config-provider";
import { ButtonWithTip } from "../ui/button";
import { Menu, MenuArrow } from "../ui/menu";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { uploadUserAttachment } from "@/lib/chat/shared";
import { useRetryChatMessage } from "@/lib/chat/server-function/retry-chat-message";
import { useSendChatMessage } from "@/lib/chat/server-function/send-chat-message";
import type { ChatMessage } from "@/lib/types";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";

export function ChatSendButton() {
  const pref = useConfigStore((state) => state.pref);
  const configStore = useConfigStoreState();

  const status = useMessageStore(
    useShallow((state) => state.messagesById[state.messageIds.at(-1)!]?.status ?? "complete"),
  );

  const { sendChatRequest } = useSendChatMessage();
  const [open, setOpen] = React.useState(false);

  async function handleSend() {
    if (status === "streaming") return;
    sendChatRequest();
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <div
        data-streaming={status === "streaming"}
        className="group flex h-9 items-center gap-2 overflow-hidden rounded-md border bg-card pl-3 data-[streaming=true]:border-destructive data-[streaming=true]:bg-destructive/60 data-[streaming=true]:pr-3"
      >
        <ButtonWithTip
          type="button"
          size="none"
          variant="none"
          title={status === "streaming" ? "Abort Request" : "Send Message"}
          className="flex h-full flex-1 cursor-pointer items-center gap-2 p-0"
          onClick={handleSend}
        >
          {status === "streaming" ? (
            <SquareIcon className="size-4" />
          ) : (
            <SendHorizontalIcon className="size-4 -rotate-45" />
          )}

          <span>{status === "streaming" ? "Abort" : "Send"}</span>
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
          <Menu.Popup className="dadata-starting-style:scale-90ata-[ending-style]:opacity-0 flex w-64 origin-(--transform-origin) flex-col gap-1 rounded-md border bg-card p-1 text-card-foreground transition-[transform,scale,opacity] data-ending-style:scale-90 data-starting-style:opacity-0">
            <MenuArrow className="fill-card" />

            <div className="px-2 pt-1 pb-2 text-sm text-muted-foreground">Choose how to send</div>

            <Menu.Item
              className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => configStore.setConfig({ pref: "enter" })}
            >
              <span className="inline-flex size-4 items-center justify-center">
                {pref === "enter" ? <CheckIcon className="size-4" /> : null}
              </span>
              <span>Press Enter to send</span>
            </Menu.Item>

            <Menu.Item
              className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => configStore.setConfig({ pref: "ctrlEnter" })}
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

export function ChatEditSendButton() {
  const pref = useConfigStore((state) => state.pref);
  const configStore = useConfigStoreState();

  const [open, setOpen] = React.useState(false);
  const [isSaving, startSaving] = React.useTransition();

  const { retryChatMessage } = useRetryChatMessage();
  const [sessionId] = useSessionId();

  async function handleSave() {
    if (isSaving) return;
    const editMessage = useChatStore.getState().editMessage;
    const threadId = useMessageStore.getState().currentThreadId;

    if (!editMessage || !sessionId || !threadId) return;

    startSaving(async () => {
      const uploaded = await uploadUserAttachment(editMessage.attachments, threadId, sessionId);

      const attachmentById = new Map<Id<"attachments">, Doc<"attachments">>();
      for (const attachment of editMessage.currentAttachments) {
        attachmentById.set(attachment._id, attachment);
      }

      const finalAttachmentIds: Array<Id<"attachments">> = [];
      const seenIds = new Set<Id<"attachments">>();

      for (const attachmentId of editMessage.keptAttachmentIds) {
        if (seenIds.has(attachmentId)) continue;
        seenIds.add(attachmentId);
        finalAttachmentIds.push(attachmentId);
      }

      for (const item of uploaded) {
        if (seenIds.has(item.attachmentId)) continue;
        seenIds.add(item.attachmentId);
        finalAttachmentIds.push(item.attachmentId);
      }

      const fileParts: Array<ChatMessage["parts"][number]> = [];

      for (const attachmentId of editMessage.keptAttachmentIds) {
        const attachment = attachmentById.get(attachmentId);
        if (!attachment) continue;

        const url = attachment.mimeType.includes("image")
          ? `https://ik.imagekit.io/gmethsnvl/ai-chat/${attachment.path}`
          : `https://files.chat.asakuri.me/${attachment.path}`;

        fileParts.push({ type: "file", url, mediaType: attachment.mimeType });
      }

      for (const item of uploaded) {
        const url = item.mediaType.includes("image")
          ? `https://ik.imagekit.io/gmethsnvl/ai-chat/${item.path}`
          : `https://files.chat.asakuri.me/${item.path}`;

        fileParts.push({ type: "file", url, mediaType: item.mediaType });
      }

      const parts: ChatMessage["parts"] = [
        { type: "text", text: editMessage.input, state: "done" },
      ];

      for (const part of fileParts) {
        parts.push(part);
      }

      // Close edit UI only after we have successfully prepared the updated message payload.
      chatStoreActions.setEditMessage(null);

      retryChatMessage({
        index: editMessage.index,
        modelId: editMessage.model,
        modelParams: editMessage.modelParams,

        userMessage: {
          messageId: editMessage._id,
          parts,
          attachments: finalAttachmentIds,
        },
      });
    });
  }

  return (
    <div className="flex gap-2">
      <ButtonWithTip
        type="button"
        size="none"
        variant="none"
        title="Cancel Editing"
        className="h-9 cursor-pointer gap-2 rounded-md border bg-card px-3"
        onClick={() => chatStoreActions.setEditMessage(null)}
        disabled={isSaving}
      >
        <XIcon className="size-4" />
        <span>Cancel</span>
      </ButtonWithTip>

      <Menu.Root open={open} onOpenChange={(next) => (!isSaving ? setOpen(next) : undefined)}>
        <div className="group flex h-9 items-center gap-2 overflow-hidden rounded-md border bg-card pl-3">
          <ButtonWithTip
            type="button"
            size="none"
            variant="none"
            title={isSaving ? "Saving..." : "Save Changes"}
            className="flex h-full flex-1 cursor-pointer items-center gap-2 p-0"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}

            <span>{isSaving ? "Saving" : "Save"}</span>
          </ButtonWithTip>

          <Menu.Trigger
            type="button"
            className="h-9 rounded-none border-l group-data-[streaming=true]:hidden"
            title="Send Preferences"
            disabled={isSaving}
            render={<ButtonWithTip delay={1000} side="top" variant="none" className="size-8" />}
          >
            <ChevronDownIcon className="size-4" />
          </Menu.Trigger>
        </div>

        <Menu.Portal>
          <Menu.Positioner className="outline-none" sideOffset={8} align="end" side="top">
            <Menu.Popup className="dadata-starting-style:scale-90ata-[ending-style]:opacity-0 flex w-64 origin-(--transform-origin) flex-col gap-1 rounded-md border bg-card p-1 text-card-foreground transition-[transform,scale,opacity] data-ending-style:scale-90 data-starting-style:opacity-0">
              <MenuArrow className="fill-card" />

              <div className="px-2 pt-1 pb-2 text-sm text-muted-foreground">Choose how to send</div>

              <Menu.Item
                className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => configStore.setConfig({ pref: "enter" })}
              >
                <span className="inline-flex size-4 items-center justify-center">
                  {pref === "enter" ? <CheckIcon className="size-4" /> : null}
                </span>
                <span>Press Enter to send</span>
              </Menu.Item>

              <Menu.Item
                className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => configStore.setConfig({ pref: "ctrlEnter" })}
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
    </div>
  );
}
