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
      <div className="bg-background/80 flex h-11 w-full shrink-0 items-center gap-2 rounded-md px-4 py-2 backdrop-blur-md backdrop-saturate-150">
        <Loader2Icon className="size-6 animate-spin" />
        <span>Waiting for response...</span>
      </div>
    );
  }

  return (
    <div
      className="group flex gap-2"
      key={message.messageId}
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
          "mx-0 gap-1 md:ml-auto md:w-auto": message.role === "user" && !editMessage,
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

      {message.role === "user" && <UserAvatar />}
    </div>
  );
}
