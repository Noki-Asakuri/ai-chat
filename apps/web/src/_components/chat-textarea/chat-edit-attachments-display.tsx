import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { FileTextIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ImageLightboxProvider, ImageLightboxTrigger } from "@/components/image-lightbox";
import { buildAttachmentUrl } from "@/lib/assets/urls";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
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
  const [localPreview, setLocalPreview] = useState<Array<LocalPreview>>([]);

  useEffect(() => {
    if (!editMessage?.attachments.length) {
      setLocalPreview([]);
      return;
    }

    const nextPreview: Array<LocalPreview> = editMessage.attachments.map(
      ({ id, type, file }): LocalPreview => {
        return { id, type, file, url: URL.createObjectURL(file) };
      },
    );

    setLocalPreview(nextPreview);

    return () => {
      for (const p of nextPreview) URL.revokeObjectURL(p.url);
    };
  }, [editMessage?.attachments]);

  if (!editMessage) return null;

  const keptIdSet = new Set(editMessage.keptAttachmentIds);

  const existingPreview: Array<ExistingPreview> = editMessage.currentAttachments
    .filter((a) => keptIdSet.has(a._id))
    .map((a) => ({
      _id: a._id,
      name: a.name,
      size: a.size,
      mimeType: a.mimeType,
      type: a.type,
      url: buildAttachmentUrl(a.path, a.mimeType),
    }));

  const hasAny = existingPreview.length > 0 || localPreview.length > 0;
  if (!hasAny) return null;

  const imageList = [
    ...existingPreview
      .filter((p) => p.type === "image")
      .map((p) => ({ src: p.url, name: p.name, bytes: p.size })),
    ...localPreview
      .filter((p) => p.type === "image")
      .map((p) => ({ src: p.url, name: p.file.name, bytes: p.file.size })),
  ];

  return (
    <div
      data-slot="attachment-display"
      className="custom-scroll flex items-center justify-start gap-2 overflow-x-auto border-b p-2.5"
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
    <div className="group relative flex justify-center gap-2 rounded-md border border-border bg-background/50 p-2 transition-colors hover:bg-foreground/10">
      {isImage && imageIndex >= 0 ? (
        <ImageLightboxTrigger
          index={imageIndex}
          type="button"
          className="overflow-hidden rounded-md"
        >
          <img src={url} alt={name} className="aspect-square size-15 object-cover object-center" />
        </ImageLightboxTrigger>
      ) : (
        <div className="flex aspect-square size-15 items-center justify-center overflow-hidden rounded-md border bg-card">
          <FileTextIcon className="size-4" />
        </div>
      )}

      <button
        type="button"
        title={`Remove ${name}`}
        className="absolute -top-2 -right-2 isolate rounded-md border bg-background p-1 text-destructive transition-colors hover:bg-foreground/20"
        onClick={onRemove}
      >
        <TrashIcon size={16} />
        <span className="sr-only">Remove {name}</span>
      </button>

      <div className="self-center">
        <p className={cn("max-w-[15ch] truncate text-sm")}>{name}</p>
        <p className="text-xs text-muted-foreground">{format.size(size)}</p>
      </div>
    </div>
  );
}
