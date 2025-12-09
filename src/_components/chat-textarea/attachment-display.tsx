import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ImagePreviewDialog } from "../image-preview-dialog";
import { useConfigStore } from "../provider/config-store-provider";
import { ButtonWithTip } from "../ui/button";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { format } from "@/lib/utils";

export function ChatAttachmentButton() {
  const model = useConfigStore((state) => state.model);
  const hasImageVision = getModelData(model)?.capabilities.vision;

  if (!hasImageVision) return null;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files![0];
    if (!file) return;

    let type: "image" | "pdf" = "image";
    if (file.type.includes("pdf")) type = "pdf";

    useChatStore
      .getState()
      .addAttachment([
        { id: uuidv4(), type, name: file.name, size: file.size, file, mimeType: file.type },
      ]);
  }

  return (
    <>
      <ButtonWithTip
        variant="ghost"
        title="Upload Image"
        className="size-9 border p-0! px-2 py-1.5 text-xs"
        type="button"
      >
        <label
          htmlFor="image-upload"
          className="flex size-full cursor-pointer items-center justify-center"
        >
          <PaperclipIcon />
          <span className="sr-only">Upload Image</span>
        </label>
      </ButtonWithTip>

      <input
        type="file"
        id="image-upload"
        accept="image/*,application/pdf"
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}

type Preview = {
  id: string;
  type: "image" | "pdf";
  url: string;
  name: string;
  size: number;
};

export function ChatAttachmentDisplay() {
  const attachments = useChatStore((state) => state.attachments);
  const [preview, setPreview] = useState<Preview[] | null>(null);

  useEffect(() => {
    if (!attachments.length) {
      setPreview(null);
      return;
    }

    const preview = attachments.map((attachment) => {
      const objectUrl = URL.createObjectURL(attachment.file);
      const preview = {
        url: objectUrl,
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
      };
      return preview;
    });
    setPreview(preview);

    return () => {
      preview.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  if (attachments.length === 0) return null;

  // Build image-only list for carousel navigation
  const imageList = preview?.filter((p) => p.type === "image") ?? [];

  return (
    <div
      data-slot="attachment-display"
      data-visible={!!preview}
      className="custom-scroll flex items-center justify-start gap-4 overflow-x-auto border-b p-2.5 data-[visible=false]:hidden"
    >
      {preview?.map((attachment) => (
        <AttachmentPreview key={attachment.id} attachment={attachment} images={imageList} />
      ))}
    </div>
  );
}

function AttachmentPreview({ attachment, images }: { attachment: Preview; images: Preview[] }) {
  // Prepare carousel images for dialog (image-only)
  const carouselImages =
    images.map((img) => ({
      src: img.url,
      alt: img.name,
      name: img.name,
      size: img.size,
    })) ?? [];

  const initialIndex = Math.max(
    0,
    images.findIndex((img) => img.id === attachment.id),
  );

  return (
    <div className="relative flex items-center justify-center gap-2">
      {attachment.type === "image" ? (
        <ImagePreviewDialog
          className="h-12 max-w-48 overflow-hidden rounded-md"
          image={{
            src: attachment.url,
            alt: attachment.name,
            name: attachment.name,
            size: attachment.size,
          }}
          images={carouselImages}
          initialIndex={initialIndex}
        >
          <img
            src={attachment.url}
            alt="Attachment"
            className="h-12 max-w-48 rounded-md object-contain"
          />
        </ImagePreviewDialog>
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-200">
          <FileIcon className="size-6" />
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <span className="line-clamp-1 max-w-[12ch]" title={attachment.name}>
          {attachment.name}
        </span>

        <div className="flex items-center justify-between gap-2">
          <span className="w-max">{format.size(attachment.size)}</span>
          <button
            className="flex w-10 cursor-pointer items-center justify-center rounded-md border border-destructive bg-destructive/60 p-0"
            onMouseDown={() => useChatStore.getState().removeAttachment(attachment.id)}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
