import type { Doc, Id } from "@/convex/_generated/dataModel";

import { FileIcon } from "lucide-react";

import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";
import { format } from "@/lib/utils";

import { ImagePreviewDialog } from "../image-preview-dialog";

type MessageAttachmentDisplayProps = {
  attachments: ChatMessage["attachments"];
  messageId?: Id<"messages">;
};

export function MessageAttachmentDisplay({
  attachments,
  messageId,
}: MessageAttachmentDisplayProps) {
  const previewImages = useChatStore((state) => state.previewImages)[messageId!] ?? [];

  const hasPersisted = !!attachments && attachments.length > 0;
  const hasPreviews = previewImages.length > 0;

  if (!hasPersisted && !hasPreviews) return null;

  return (
    <div
      role="list"
      aria-label="Attachments"
      className="flex flex-wrap items-center justify-end gap-2 group-data-[role='assistant']:justify-start"
    >
      {!hasPersisted &&
        hasPreviews &&
        previewImages.map((img, idx) => (
          <ImagePreviewDialog
            key={`preview-${idx}`}
            className="aspect-square size-40 overflow-hidden rounded-md"
            image={{
              src: img.src,
              alt: "Generating image...",
              name: "Generating image...",
              size: img.size,
            }}
          >
            <img
              alt="Attachment preview"
              className="size-full rounded-md border object-cover"
              src={img.src}
            />
          </ImagePreviewDialog>
        ))}

      {hasPersisted &&
        attachments.map((attachment) => (
          <AttachmentPreview key={attachment._id} attachment={attachment} />
        ))}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Doc<"attachments"> }) {
  if (attachment.type === "image") {
    const imageUrl = `https://ik.imagekit.io/gmethsnvl/ai-chat/${attachment.userId}/${attachment.threadId}/${attachment._id}`;

    return (
      <ImagePreviewDialog
        className="aspect-square size-40 overflow-hidden rounded-md"
        image={{
          src: imageUrl,
          alt: attachment.name,
          name: attachment.name,
          size: attachment.size,
        }}
      >
        <img alt="Attachment" className="size-full rounded-md border object-cover" src={imageUrl} />
      </ImagePreviewDialog>
    );
  }

  if (attachment.type === "pdf") {
    const fileUrl = `https://files.chat.asakuri.me/${attachment.userId}/${attachment.threadId}/${attachment._id}`;

    return (
      <a
        href={fileUrl}
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
