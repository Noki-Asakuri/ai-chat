import { MemoizedMarkdown } from "../markdown";

import { MessageAttachmentDisplay } from "./message-attachment-display";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

type MessageContentProps = {
  message: ChatMessage;
  content: string;
};

export function MessageContent({ message, content }: MessageContentProps) {
  return (
    <div
      className={cn("space-y-6", {
        "bg-sidebar/50 rounded-md border px-4 py-2": message.role === "user",
        "bg-destructive/20 border-destructive/50 rounded-md border px-4 py-2 backdrop-blur-md":
          message.status === "error",
      })}
    >
      {message.status === "error" ? (
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        <p>{message.error || "An error have occurred. Please try again."}</p>
      ) : (
        <MemoizedMarkdown id={message.messageId} content={content} />
      )}

      <MessageAttachmentDisplay message={message} />
    </div>
  );
}
