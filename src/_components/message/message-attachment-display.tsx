import type { Doc, Id } from "@/convex/_generated/dataModel";

import { Link } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";

import { ImagePreviewDialog } from "../image-preview-dialog";

import type { ChatMessage } from "@/lib/types";
import { format } from "@/lib/utils";

type MessageAttachmentDisplayProps = {
  attachments: ChatMessage["attachments"];
  messageId?: Id<"messages">;
};

function imageUrlFromAttachment(att: Doc<"attachments">): string {
  if (att.path) return `https://ik.imagekit.io/gmethsnvl/ai-chat/${att.path}`;
  // Fallback to legacy path
  return `https://ik.imagekit.io/gmethsnvl/ai-chat/${att.userId}/${att.threadId}/${att._id}`;
}

export function MessageAttachmentDisplay({
  attachments,
  messageId,
}: MessageAttachmentDisplayProps) {
  const previewImages = previewImagesMap[messageId!] ?? [];

  // Split persisted attachments into images vs. others.
  const persistedAll = attachments ?? [];
  const persistedImages = persistedAll.filter((a) => a.type === "image");
  const otherAttachments = persistedAll.filter((a) => a.type !== "image");

  const totalImageSlots = Math.max(previewImages.length, persistedImages.length);

  if (totalImageSlots === 0 && otherAttachments.length === 0) return null;

  const baseKey = messageId ?? "no-message";

  // Build a normalized list of image entries preserving visual order (by slot index).
  // Each slot may be from a persisted attachment or a preview image, or be empty.
  const imageSlots: Array<{ src?: string; alt: string; name: string; size?: number } | null> =
    Array.from({ length: totalImageSlots }).map((_, idx) => {
      const att = persistedImages[idx] as Doc<"attachments"> | undefined;
      const prev = previewImages[idx] as { src: string; size?: number; name?: string } | undefined;

      if (att) {
        return { src: imageUrlFromAttachment(att), alt: att.name, name: att.name, size: att.size };
      }

      if (prev) {
        return {
          src: prev.src,
          alt: prev.name ?? "Attachment preview",
          name: prev.name ?? "Attachment preview",
          size: prev.size,
        };
      }

      return null;
    });

  function renderImageSlot(idx: number) {
    const att = persistedImages[idx];
    const prev = previewImages[idx];

    if (!att && !prev) return null;

    const size = att?.size ?? prev?.size;
    const src = att ? imageUrlFromAttachment(att) : prev!.src;
    const name = att?.name ?? prev?.name ?? "Generating image...";

    // Compute the initial index within the compacted images list (exclude empty slots).
    const compactImages = imageSlots.filter(
      (v): v is { src?: string; alt: string; name: string; size?: number } => v !== null,
    );

    const initialIndexWithinList =
      imageSlots.slice(0, idx + 1).filter((v) => v !== null).length - 1;

    // IMPORTANT: Always render the same component type (ImagePreviewDialog) with a stable key,
    // so when a preview transitions to a persisted attachment, the dialog instance stays mounted.
    return (
      <ImagePreviewDialog
        images={compactImages}
        key={`${baseKey}-image-slot-${idx}`}
        image={{ src, alt: name, name, size }}
        className="aspect-square size-20 overflow-hidden rounded-md"
        initialIndex={Math.max(0, initialIndexWithinList)}
      >
        <img
          alt={att ? "Attachment" : "Attachment preview"}
          className="size-full rounded-md border object-cover"
          src={src}
        />
      </ImagePreviewDialog>
    );
  }

  return (
    <div
      role="list"
      aria-label="Attachments"
      className="flex flex-wrap items-center justify-end gap-2 group-data-[role='assistant']:justify-start"
    >
      {/* Image slots: keep identity stable across preview -> persisted transitions */}
      {Array.from({ length: totalImageSlots }).map((_, idx) => renderImageSlot(idx))}

      {/* Non-image attachments (e.g., PDFs) */}
      {otherAttachments.map((attachment) => (
        <AttachmentPreview key={attachment._id} attachment={attachment} />
      ))}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Doc<"attachments"> }) {
  if (attachment.type === "image") {
    const imageUrl = `https://ik.imagekit.io/gmethsnvl/ai-chat/${attachment.path}`;

    return (
      <ImagePreviewDialog
        className="aspect-square size-20 overflow-hidden rounded-md"
        image={{
          src: imageUrl,
          alt: attachment.name,
          name: attachment.name,
          size: attachment.size,
        }}
      >
        <img src={imageUrl} alt="Attachment" className="size-full rounded-md border object-cover" />
      </ImagePreviewDialog>
    );
  }

  if (attachment.type === "pdf") {
    const fileUrl = `https://files.chat.asakuri.me/${attachment.path}`;

    return (
      <Link
        to={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-20 flex-col items-center justify-center gap-2 rounded-md border p-2"
      >
        <FileIcon className="size-8" />

        <div className="flex w-full flex-col gap-1 text-center">
          <span className="truncate text-sm">{attachment.name}</span>
          <span className="text-xs">{format.size(attachment.size)}</span>
        </div>
      </Link>
    );
  }

  return null;
}
