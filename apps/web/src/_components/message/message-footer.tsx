import { MessageActionButtons, MessageVariantPager } from "./message-action-buttons";
import { hasImageGenerationPart } from "./message-flow";
import { MessageMetadata } from "./message-metadata";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageFooterProps = {
  isLast: boolean;
  message: ChatMessage;
  readOnly?: boolean;
  showUserAvatar?: boolean;
};

export function MessageFooter({
  isLast,
  message,
  readOnly = false,
  showUserAvatar = true,
}: MessageFooterProps) {
  const isFinished = message.status === "complete" || message.status === "error";

  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex min-h-8 w-full min-w-0 items-center gap-1 text-xs text-muted-foreground tabular-nums",
        "opacity-0 transition-opacity duration-200 motion-reduce:transition-none pointer-coarse:opacity-100",
        "group-focus-within/message-row:opacity-100 group-hover/message-row:opacity-100",
        "has-[[aria-expanded=true]]:opacity-100",
        message.role === "user" ? "justify-end" : "sm:pl-12",
        message.role === "user" && showUserAvatar && "pr-9 sm:pr-11",
        isLast && "opacity-100",
      )}
    >
      {!readOnly && <MessageActionButtons message={message} isFinished={isFinished} />}

      {message.role === "assistant" && (
        <MessageMetadata
          metadata={message.metadata}
          showTokenStats={!hasImageGenerationPart(message.parts ?? [])}
          rightAccessory={readOnly ? undefined : <MessageVariantPager message={message} />}
        />
      )}
    </div>
  );
}
