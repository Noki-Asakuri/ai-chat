import { MessageAttachmentDisplay } from "./message-attachment-display";
import { MemoizedMarkdown } from "./message-markdown";

import type { ChatMessage } from "@/lib/types";

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
    <>
      {message.role === "user" && <MessageAttachmentDisplay attachments={message.attachments} />}

      <div className="bg-background/80 grow-0 space-y-4 rounded-md border p-2 backdrop-blur-md backdrop-saturate-150 group-data-[role=user]:ml-auto group-data-[role=user]:w-max group-data-[role=user]:max-w-full md:p-4">
        <MemoizedMarkdown id={message.messageId} content={content} />
        {message.role === "assistant" && (
          <MessageAttachmentDisplay attachments={message.attachments} messageId={message._id} />
        )}
      </div>
    </>
  );
}

function MessageError({ message }: { message: string }) {
  return (
    <div className="bg-destructive/40 border-destructive/60 text-destructive-foreground rounded-md border px-4 py-2 backdrop-blur-md backdrop-saturate-150">
      <p>{message}</p>
    </div>
  );
}
