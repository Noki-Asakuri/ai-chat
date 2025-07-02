import { MessageActionButtons } from "./message-action-buttons";
import { MessageMetadata } from "./message-metadata";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageFooterProps = {
  index: number;
  message: ChatMessage;
  renderMessage: { reasoning?: string; metadata?: ChatMessage["metadata"] };
};

export function MessageFooter({ index, message, renderMessage }: MessageFooterProps) {
  const isFinished = message.status === "complete" || message.status === "error";
  if (!isFinished) return null;

  return (
    <div
      className={cn(
        "mt-2 flex w-full items-center gap-2 transition-opacity sm:pointer-events-none sm:opacity-0",
        "group-hover:pointer-events-auto group-hover:opacity-100",
        "group-data-[open=true]:pointer-events-auto group-data-[open=true]:opacity-100",
        { "justify-end bg-transparent": message.role === "user" },
      )}
    >
      <MessageActionButtons index={index} message={message} />

      <MessageMetadata
        model={message.model}
        metadata={renderMessage.metadata}
        hiddenReasoning={!renderMessage.reasoning}
      />
    </div>
  );
}
