import { MessageActionButtons, MessageVariantPager } from "./message-action-buttons";
import { MessageMetadata } from "./message-metadata";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageFooterProps = {
  isLast: boolean;
  message: ChatMessage;
  readOnly?: boolean;
};

export function MessageFooter({ isLast, message, readOnly = false }: MessageFooterProps) {
  const isFinished = message.status === "complete" || message.status === "error";

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
        "group-has-[button[aria-expanded=true]]:opacity-100",
        {
          "justify-end bg-transparent": message.role === "user",
          "opacity-100": isLast,
        },
      )}
    >
      {!readOnly && <MessageActionButtons message={message} isFinished={isFinished} />}

      {message.role === "assistant" && (
        <MessageMetadata
          metadata={message.metadata}
          rightAccessory={readOnly ? undefined : <MessageVariantPager message={message} />}
        />
      )}
    </div>
  );
}
