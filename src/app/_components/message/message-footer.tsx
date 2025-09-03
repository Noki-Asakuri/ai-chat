import { MessageActionButtons } from "./message-action-buttons";
import { MessageMetadata } from "./message-metadata";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageFooterProps = {
  index: number;
  message: ChatMessage;
  renderMessage: { metadata?: ChatMessage["metadata"] };
};

export function MessageFooter({ index, message, renderMessage }: MessageFooterProps) {
  const isFinished = message.status === "complete" || message.status === "error";
  if (!isFinished) return null;

  return (
    <div
      className={cn("flex w-full items-center gap-4", {
        "justify-end bg-transparent": message.role === "user",
      })}
    >
      <MessageActionButtons index={index} message={message} />
      <MessageMetadata model={message.model} metadata={renderMessage.metadata} />
    </div>
  );
}
