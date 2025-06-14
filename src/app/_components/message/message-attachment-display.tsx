import type { Doc } from "@/convex/_generated/dataModel";
import { FileIcon } from "lucide-react";

import type { ChatMessage } from "@/lib/types";

export function MessageAttachmentDisplay({ message }: { message: ChatMessage }) {
  if (!message.attachments || message.attachments.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {message.attachments.map((attachment) => (
        <AttachmentPreview key={attachment._id} attachment={attachment} />
      ))}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Doc<"attachments"> }) {
  const attachmentUrl = `https://files.chat.asakuri.me/${attachment.userId}/${attachment.threadId}/${attachment._id}`;

  if (attachment.type === "image") {
    return (
      <a href={attachmentUrl} target="_blank" rel="noopener noreferrer">
        <img
          alt="Attachment"
          className="aspect-square h-32 rounded-md object-contain"
          src={attachmentUrl}
        />
      </a>
    );
  }

  if (attachment.type === "pdf" || attachment.type === "doc") {
    return (
      <a
        href={attachmentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center gap-2 rounded-md border p-2"
      >
        <FileIcon className="size-8" />
        <span className="line-clamp-1 text-sm">{attachment.name}</span>
      </a>
    );
  }

  return null;
}
