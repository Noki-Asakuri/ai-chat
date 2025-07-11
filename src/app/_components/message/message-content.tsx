import { MemoizedMarkdown } from "../markdown";

import { MessageAttachmentDisplay } from "./message-attachment-display";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageContentProps = {
  message: ChatMessage;
  content: string;
};

export function MessageContent({ message, content }: MessageContentProps) {
  if (message.status === "error") {
    const error = message.error?.length
      ? message.error
      : "An error have occurred. Please try again.";

    return <MessageError message={error} />;
  }

  if (!content) return null;

  return (
    <div
      className={cn(
        "bg-background/80 grow-0 space-y-4 rounded-md border p-2 backdrop-blur-md backdrop-saturate-150 md:p-4",
        {
          "group-data-[disable-blur=true]/sidebar-provider:border-0": message.role === "assistant",
        },
      )}
    >
      <MemoizedMarkdown id={message.messageId} content={content} />
      <MessageAttachmentDisplay message={message} />
    </div>
  );
}

function MessageError({ message }: { message: string }) {
  return (
    <div className="bg-destructive/40 border-destructive/60 text-destructive-foreground rounded-md border px-4 py-2 backdrop-blur-md backdrop-saturate-150">
      <p>{message}</p>
    </div>
  );
}
