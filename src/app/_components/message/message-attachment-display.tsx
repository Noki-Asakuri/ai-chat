import type { Doc } from "@/convex/_generated/dataModel";

import { FileIcon } from "lucide-react";

import type { ChatMessage } from "@/lib/types";
import { format } from "@/lib/utils";
import { ImagePreviewDialog } from "../image-preview-dialog";

export function MessageAttachmentDisplay({ message }: { message: ChatMessage }) {
  if (!message.attachments || message.attachments.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Attachments"
      className="flex flex-wrap items-center justify-start gap-2"
    >
      {message.attachments.map((attachment) => (
        <AttachmentPreview key={attachment._id} attachment={attachment} />
      ))}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Doc<"attachments"> }) {
  const attachmentUrl = `https://ik.imagekit.io/gmethsnvl/ai-chat/${attachment.userId}/${attachment.threadId}/${attachment._id}`;

  if (attachment.type === "image") {
    return (
      <ImagePreviewDialog
        className="aspect-square size-40 overflow-hidden rounded-md"
        image={{
          src: attachmentUrl,
          alt: attachment.name,
          name: attachment.name,
          size: attachment.size,
        }}
      >
        <img alt="Attachment" className="size-full object-cover" src={attachmentUrl} />
      </ImagePreviewDialog>
    );
  }

  if (attachment.type === "pdf" || attachment.type === "doc") {
    return (
      <a
        href={attachmentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-40 flex-col items-center justify-center gap-2 rounded-md border p-2"
      >
        <FileIcon className="size-8" />

        <div className="flex w-full flex-col gap-1 text-center">
          <span className="truncate text-sm">{attachment.name}</span>
          <span className="text-xs">{format.size(attachment.size)}</span>
        </div>
      </a>
    );
  }

  return null;
}
