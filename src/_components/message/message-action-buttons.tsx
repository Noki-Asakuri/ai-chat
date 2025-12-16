import type { Id } from "@/convex/_generated/dataModel";

import { BugPlayIcon, PencilIcon, SplitIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { CopyButton } from "../copy-button";
import { ButtonWithTip } from "../ui/button";
import { MessageRetryMenu } from "./message-retry-menu";

import { useBranchThread } from "@/lib/chat/server-function/branch-thread";
import { chatStoreActions } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";
import type { TextUIPart } from "ai";

type MessageActionButtonsProps = {
  index: number;
  isFinished: boolean;
  message: ChatMessage;
};

export function MessageActionButtons({ index, isFinished, message }: MessageActionButtonsProps) {
  const { branchThread } = useBranchThread();
  if (import.meta.env.PROD && !isFinished) return null;

  const content = message.parts
    .filter((p): p is TextUIPart => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");

  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-background/80 p-1 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:border-0">
      {isFinished && (
        <>
          <CopyButton
            side="bottom"
            className="size-8"
            content={message.status === "error" ? message.error || "" : content}
          />

          {message.role === "assistant" && (
            <ButtonWithTip
              variant="ghost"
              side="bottom"
              className="size-8"
              onMouseDown={() => branchThread(message._id)}
              title="Branch off at this message"
              disabled={message.status === "pending" || message.status === "streaming"}
            >
              <SplitIcon className="size-4 rotate-180" />
            </ButtonWithTip>
          )}

          <MessageRetryMenu index={index} message={message} className="size-8" />
        </>
      )}

      <EditButton message={message} />
      <DebugButton messageId={message._id} />
    </div>
  );
}

function DebugButton({ messageId }: { messageId: Id<"messages"> }) {
  const message = useMessageStore(useShallow((state) => state.messagesById[messageId]!));
  if (import.meta.env.PROD) return null;

  function handleDebug() {
    console.log(message);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(message, null, 2));
    }
  }

  return (
    <ButtonWithTip
      variant="ghost"
      side="bottom"
      className="size-8"
      title="Debug"
      onClick={handleDebug}
    >
      <BugPlayIcon className="size-4" />
      <span className="sr-only">Debug</span>
    </ButtonWithTip>
  );
}

function EditButton({ message }: { message: ChatMessage }) {
  const status = useMessageStore(
    (state) => state.messagesById[state.messageIds.at(-1)!]?.status ?? "complete",
  );

  const isPending = status === "pending" || status === "streaming";

  if (message.role === "assistant") return null;
  function handleEditMessage() {
    if (message.role === "assistant") return;
    const state = useMessageStore.getState();

    const assistantMessageIndex = state.messageIds.indexOf(message._id) + 1;
    const assistantMessage = state.messagesById[state.messageIds[assistantMessageIndex]!]!;

    chatStoreActions.setEditMessage({
      _id: message._id,
      index: assistantMessageIndex - 1,
      input: message.parts
        .filter((p): p is TextUIPart => p.type === "text")
        .map((p) => p.text)
        .join("\n\n"),

      attachments: [],
      currentAttachments: message.attachments,
      keptAttachmentIds: message.attachments.map((a) => a._id),
      model: assistantMessage.metadata!.model.request,
      modelParams: assistantMessage.metadata!.modelParams,
    });
  }

  return (
    <ButtonWithTip
      variant="ghost"
      side="bottom"
      className="size-8"
      onMouseDown={handleEditMessage}
      disabled={isPending}
      title="Edit Message"
    >
      <PencilIcon className="size-4" />
      <span className="sr-only">Edit Message</span>
    </ButtonWithTip>
  );
}
