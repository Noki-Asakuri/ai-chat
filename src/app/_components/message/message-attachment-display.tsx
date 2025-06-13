import type { Doc } from "@/convex/_generated/dataModel";

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
  if (attachment.type === "image") {
    return (
      <img
        alt="Attachment"
        className="aspect-square h-32 rounded-md object-contain"
        src={`https://files.chat.asakuri.me/${attachment.userId}/${attachment.threadId}/${attachment._id}`}
      />
    );
  }

  return null;
}
