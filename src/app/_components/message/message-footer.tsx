import { MessageActionButtons } from "./message-action-buttons";
import { MessageMetadata } from "./message-metadata";

import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageFooterProps = {
  index: number;
  message: ChatMessage;
  renderMessage: { reasoning?: string; metadata?: ChatMessage["metadata"] };
};

export function MessageFooter({ index, message, renderMessage }: MessageFooterProps) {
  const editMessage = useChatStore((state) => state.editMessage);

  return (
    <div
      className={cn(
        "pointer-events-none absolute -bottom-12 flex w-full flex-wrap gap-2 transition-opacity select-none sm:opacity-0",
        {
          "pointer-events-auto group-hover:opacity-100":
            message.status === "error" || message.status === "complete",
          hidden: message.status === "pending" || message.status === "streaming",
          "right-0": message.role === "user",
          "opacity-100": editMessage?._id === message._id,
        },
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
