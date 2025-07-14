import { Loader2Icon } from "lucide-react";

import { MessageContent } from "./message-content";
import { MessageEdit } from "./message-edit";
import { MessageFooter } from "./message-footer";
import { ThinkingToggle } from "./message-thinking";
import { UserAvatar } from "./user-avatar";

import { useChatStore } from "@/lib/chat/store";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageProps = {
  message: ChatMessage;
  index: number;
  isLast: boolean;
};

export function Message({ message, index, isLast }: MessageProps) {
  const assistantMessage = useChatStore((state) => state.assistantMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const popupRetryMessageId = useChatStore((state) => state.popupRetryMessageId);
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const userMessage =
    message.role === "assistant"
      ? document.querySelector<HTMLDivElement>(`div[data-index='${index - 1}']`)
      : null;

  const minHeight = isLast
    ? // 100vh - (padding top + padding bottom + textarea height + user message height)
      `calc(100vh - (40px + ${Math.max(textareaHeight, 160)}px + 16px + ${userMessage?.clientHeight ?? 114}px))`
    : "auto";

  const renderMessage =
    message.role === "assistant" &&
    assistantMessage?.id === message._id &&
    message.status === "streaming"
      ? assistantMessage
      : message;

  const isLoading =
    (message.status === "streaming" || message.status === "pending") &&
    !renderMessage.content &&
    !renderMessage.reasoning;

  return (
    <div
      className="message group flex gap-2"
      key={message.messageId}
      data-index={index}
      data-role={message.role}
      data-id={message.messageId}
      data-status={message.status}
      data-streaming={message.status === "streaming" || message.status === "pending"}
      data-open={popupRetryMessageId === message._id || editMessage?._id === message._id}
      style={{ minHeight }}
    >
      {isLoading ? (
        <MessageLoading />
      ) : (
        <MessageInner message={message} index={index} isLast={isLast} />
      )}

      {message.role === "user" && <UserAvatar />}
    </div>
  );
}

function MessageLoading() {
  return (
    <div className="bg-background/80 flex h-11 w-full shrink-0 items-center gap-2 rounded-md border px-4 py-2 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:border-0">
      <Loader2Icon className="size-6 animate-spin" />
      <span>Waiting for response...</span>
    </div>
  );
}

function MessageInner({ message, index }: MessageProps) {
  const isMobile = useIsMobile();

  const editMessage = useChatStore((state) => state.editMessage);
  const assistantMessage = useChatStore((state) => state.assistantMessage);

  const renderMessage =
    message.role === "assistant" &&
    assistantMessage?.id === message._id &&
    message.status === "streaming"
      ? assistantMessage
      : message;

  return (
    <div
      className={cn("relative flex grow-0 flex-col", "[&:has(.codeblock)]:w-full", {
        hidden: message.status === "pending",
        "w-full": message.role === "assistant" || editMessage?._id === message._id || isMobile,
        "mx-0 max-w-[calc(100%-44px-8px)] gap-1 md:ml-auto":
          message.role === "user" && !editMessage,
      })}
    >
      <ThinkingToggle
        status={message.status}
        messageId={message.messageId}
        message={renderMessage}
      />

      {message.role === "user" && editMessage?._id === message._id ? (
        <MessageEdit content={message.content} index={index} id={message._id} />
      ) : (
        <MessageContent content={renderMessage.content} message={message} />
      )}

      <MessageFooter message={message} index={index} renderMessage={renderMessage} />
    </div>
  );
}
