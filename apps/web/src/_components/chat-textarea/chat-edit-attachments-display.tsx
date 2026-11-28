import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { FileTextIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ImageLightboxProvider, ImageLightboxTrigger } from "@/components/image-lightbox";
import { buildAttachmentUrl } from "@/lib/assets/urls";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import type { UserAttachment } from "@/lib/types";
import { cn, format } from "@/lib/utils";

type LocalPreview = {
  id: string;
  type: "image" | "pdf";
  file: File;
  url: string;
};

type ExistingPreview = {
  _id: Id<"attachments">;
  name: string;
  size: number;
  mimeType: string;
  type: "image" | "pdf";
  url: string;
};

export function ChatEditAttachmentsDisplay() {
  const editMessage = useChatStore((state) => state.editMessage);
  if (!editMessage) return null;

  return (
    <ChatEditAttachmentPreviews
      key={editMessage.attachments.map((attachment) => attachment.id).join(":")}
      attachments={editMessage.attachments}
      currentAttachments={editMessage.currentAttachments}
      keptAttachmentIds={editMessage.keptAttachmentIds}
    />
  );
}

type ChatEditAttachmentPreviewsProps = {
  attachments: UserAttachment[];
  currentAttachments: Array<Doc<"attachments">>;
  keptAttachmentIds: Array<Id<"attachments">>;
};

function ChatEditAttachmentPreviews({
  attachments,
  currentAttachments,
  keptAttachmentIds,
}: ChatEditAttachmentPreviewsProps) {
  const [localPreview, setLocalPreview] = useState<Array<LocalPreview>>([]);

  useEffect(() => {
    const nextPreview = attachments.map(({ id, type, file }) => ({
      id,
      type,
      file,
      url: URL.createObjectURL(file),
    }));
    let active = true;
    queueMicrotask(() => {
      if (active) setLocalPreview(nextPreview);
    });

    return () => {
      active = false;
      for (const attachment of nextPreview) URL.revokeObjectURL(attachment.url);
    };
  }, [attachments]);

  const keptIdSet = new Set(keptAttachmentIds);

  const existingPreview: Array<ExistingPreview> = [];
  for (const attachment of currentAttachments) {
    if (!keptIdSet.has(attachment._id)) continue;

    existingPreview.push({
      _id: attachment._id,
      name: attachment.name,
      size: attachment.size,
      mimeType: attachment.mimeType,
      type: attachment.type,
      url: buildAttachmentUrl(attachment.path, attachment.mimeType),
    });
  }

  const hasAny = existingPreview.length > 0 || localPreview.length > 0;
  if (!hasAny) return null;

  const imageList: Array<{ src: string; name: string; bytes: number }> = [];
  for (const preview of existingPreview) {
    if (preview.type === "image") {
      imageList.push({ src: preview.url, name: preview.name, bytes: preview.size });
    }
  }

  for (const preview of localPreview) {
    if (preview.type === "image") {
      imageList.push({ src: preview.url, name: preview.file.name, bytes: preview.file.size });
    }
  }

  return (
    <div
      data-slot="attachment-display"
      className="flex items-center justify-start gap-2 overflow-x-auto px-3 pt-3"
    >
      <ImageLightboxProvider images={imageList}>
        {existingPreview.map((attachment) => {
          const isImage = attachment.type === "image";
          const imageIndex = isImage ? imageList.findIndex((i) => i.src === attachment.url) : -1;

          return (
            <AttachmentPill
              key={attachment._id}
              name={attachment.name}
              size={attachment.size}
              url={attachment.url}
              isImage={isImage}
              imageIndex={imageIndex}
              onRemove={() => chatStoreActions.removeEditExistingAttachment(attachment._id)}
            />
          );
        })}

        {localPreview.map((attachment) => {
          const isImage = attachment.type === "image";
          const imageIndex = isImage ? imageList.findIndex((i) => i.src === attachment.url) : -1;

          return (
            <AttachmentPill
              key={attachment.id}
              name={attachment.file.name}
              size={attachment.file.size}
              url={attachment.url}
              isImage={isImage}
              imageIndex={imageIndex}
              onRemove={() => chatStoreActions.removeEditAttachment(attachment.id)}
            />
          );
        })}
      </ImageLightboxProvider>
    </div>
  );
}

type AttachmentPillProps = {
  name: string;
  size: number;
  url: string;
  isImage: boolean;
  imageIndex: number;
  onRemove: () => void;
};

function AttachmentPill({ name, size, url, isImage, imageIndex, onRemove }: AttachmentPillProps) {
  return (
    <div className="group relative flex shrink-0 items-center gap-2.5 rounded-xl bg-foreground/5 py-1.5 pr-3 pl-1.5 transition-colors hover:bg-foreground/8">
      {isImage && imageIndex >= 0 ? (
        <ImageLightboxTrigger index={imageIndex} type="button" className="overflow-hidden rounded-lg">
          <img src={url} alt={name} className="aspect-square size-10 object-cover object-center" />
        </ImageLightboxTrigger>
      ) : (
        <div className="flex aspect-square size-10 items-center justify-center overflow-hidden rounded-lg bg-foreground/6">
          <FileTextIcon className="size-4" />
        </div>
      )}

      <button
        type="button"
        title={`Remove ${name}`}
        className="absolute -top-1.5 -right-1.5 isolate grid size-5 cursor-pointer place-items-center rounded-full border border-border bg-popover text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
        onClick={onRemove}
      >
        <XIcon size={12} />
        <span className="sr-only">Remove {name}</span>
      </button>

      <div className="min-w-0">
        <p className={cn("max-w-[18ch] truncate text-xs leading-tight")}>{name}</p>
        <p className="text-2xs text-muted-foreground">{format.size(size)}</p>
      </div>
    </div>
  );
}
