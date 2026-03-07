import { MessageVariantPager } from "./message-action-buttons";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageFooterProps = {
  isLast: boolean;
  message: ChatMessage;
  readOnly?: boolean;
};

export function MessageFooter({ isLast, message, readOnly = false }: MessageFooterProps) {
  if (message.role !== "assistant") return null;

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100",
        "mt-2 w-full items-center group-has-[button[aria-expanded=true]]:opacity-100",
        { "opacity-100": isLast },
      )}
    >
      {!readOnly && <MessageVariantPager message={message} />}
    </div>
  );
}
