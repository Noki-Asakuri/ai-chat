import { Loader2Icon } from "lucide-react";

import { MessageContent } from "./message-content";
import { MessageEdit } from "./message-edit";
import { MessageFooter } from "./message-footer";
import { ThinkingToggle } from "./message-thinking";
import { UserAvatar } from "./user-avatar";

import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageProps = {
  message: ChatMessage;
  index: number;
  isLast: boolean;
};

export function Message({ message, index }: MessageProps) {
  const assistantMessage = useChatStore((state) => state.assistantMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const popupRetryMessageId = useChatStore((state) => state.popupRetryMessageId);

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

  if (isLoading) {
    return (
      <div className="flex h-11 shrink-0 items-center">
        <Loader2Icon className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="group flex gap-2"
      data-index={index}
      data-role={message.role}
      data-id={message.messageId}
      data-status={message.status}
      data-streaming={message.status === "streaming" || message.status === "pending"}
      data-open={popupRetryMessageId === message._id || editMessage?._id === message._id}
    >
      <div
        className={cn("relative flex w-full flex-col", {
          hidden: message.status === "pending",
          "mx-0 ml-auto w-auto gap-1": message.role === "user" && !editMessage,
        })}
      >
        <ThinkingToggle
          messageId={message.messageId}
          finished={renderMessage.content.length > 0}
          reasoning={renderMessage.reasoning}
          status={message.status}
          tokens={renderMessage.metadata?.thinkingTokens}
        />

        {message.role === "user" && editMessage?._id === message._id ? (
          <MessageEdit content={message.content} index={index} id={message._id} />
        ) : (
          <MessageContent content={renderMessage.content} message={message} />
        )}

        <MessageFooter message={message} index={index} renderMessage={renderMessage} />
      </div>

      {message.role === "user" && <UserAvatar />}
    </div>
  );
}
