import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { BanIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { MessageContent } from "./message-content";
import { MessageFooter } from "./message-footer";

import { ChatEditTextarea } from "../chat-textarea/chat-edit-textarea";

import { useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";

type MessageProps = {
  messageId: Id<"messages">;
  index: number;
  total: number;
  readOnly?: boolean;
  showUserAvatar?: boolean;
};

export function Message({ messageId, index, total, readOnly = false, showUserAvatar = true }: MessageProps) {
  const message = useMessageStore(useShallow((state) => state.messagesById[messageId]!));
  const isLast = isLastMessage(message.role, index, total);

  return (
    <div
      data-slot="message"
      className="group/message-row flex flex-col gap-1"
      key={message._id}
      data-index={index}
      data-islast={isLast}
      data-role={message.role}
      data-model={message.metadata?.model.request}
      data-id={message._id}
      data-effort={message.metadata?.modelParams.effort}
      data-web-search={message.metadata?.modelParams.webSearch ?? false}
    >
      <MessageInner message={message} isLast={isLast} readOnly={readOnly} showUserAvatar={showUserAvatar} />
    </div>
  );
}

function isLastMessage(role: ChatMessage["role"], index: number, total: number): boolean {
  if (index === total - 1) return true;
  if (role === "user" && index === total - 2) return true;
  return false;
}

type MessageInnerProps = {
  message: ChatMessage;
  isLast: boolean;
  readOnly?: boolean;
  showUserAvatar?: boolean;
};

function MessageInner({ message, isLast, readOnly = false, showUserAvatar = true }: MessageInnerProps) {
  const editMessageId = useChatStore((state) => state.editMessage?._id);
  const isEditingMessage = message._id === editMessageId;

  if (isEditingMessage && !readOnly) return <ChatEditTextarea />;

  const isMessageCancelled = message.role === "assistant" && message.metadata?.finishReason === "aborted";

  return (
    <>
      <MessageContent message={message} showUserAvatar={showUserAvatar} />
      {isMessageCancelled && <CancelledMessage />}
      <MessageFooter isLast={isLast} message={message} readOnly={readOnly} showUserAvatar={showUserAvatar} />
    </>
  );
}

function CancelledMessage() {
  return (
    <div className="flex px-0.5 sm:pl-12">
      <span
        data-message-surface="chip"
        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground"
      >
        <BanIcon aria-hidden="true" className="size-3" />
        Cancelled
      </span>
    </div>
  );
}
