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
  const popupRetryMessageId = useChatStore((state) => state.popupRetryMessageId);

  const isFinished = message.status === "complete" || message.status === "error";

  return (
    <div
      data-open={popupRetryMessageId === message._id}
      className={cn(
        "pointer-events-none mt-2 hidden w-full items-center gap-2 transition-opacity select-none sm:opacity-0",
        "data-[open=true]:opacity-100",
        {
          "justify-end": message.role === "user",
          "opacity-100": editMessage?._id === message._id,
          "pointer-events-auto flex group-hover:opacity-100": isFinished,
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
