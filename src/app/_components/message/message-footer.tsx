import { MessageActionButtons } from "./message-action-buttons";
import { MessageMetadata } from "./message-metadata";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageFooterProps = {
  index: number;
  isLast: boolean;
  message: ChatMessage;
  renderMessage: { metadata?: ChatMessage["metadata"] };
};

export function MessageFooter({ index, isLast, message, renderMessage }: MessageFooterProps) {
  const isFinished = message.status === "complete" || message.status === "error";

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
        {
          "justify-end bg-transparent": message.role === "user",
          "opacity-100": isLast,
        },
      )}
    >
      {isFinished && <MessageActionButtons index={index} message={message} />}

      {message.role === "assistant" && (
        <MessageMetadata
          metadata={renderMessage.metadata}
          params={message.modelParams}
          model={message.model}
        />
      )}
    </div>
  );
}
