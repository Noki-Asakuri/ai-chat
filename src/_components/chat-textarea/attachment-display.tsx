import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ImagePreviewDialog } from "../image-preview-dialog";
import { useConfigStore } from "../provider/config-provider";
import { ButtonWithTip } from "../ui/button";

import { getModelData } from "@/lib/chat/models";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
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

    chatStoreActions.addAttachments([{ id: uuidv4(), type, file }]);
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
  file: File;
  url: string;
};

export function ChatAttachmentDisplay() {
  const attachments = useChatStore((state) => state.attachments);
  const [preview, setPreview] = useState<Preview[]>([]);

  useEffect(() => {
    if (!attachments.length) {
      setPreview([]);
      return;
    }

    const preview: Preview[] = attachments.map(({ id, type, file }) => {
      const url = URL.createObjectURL(file);
      return { id, type, file, url };
    });

    setPreview(preview);

    return () => {
      for (const p of preview) URL.revokeObjectURL(p.url);
    };
  }, [attachments]);

  const imageList = preview?.filter((p) => p.type === "image") ?? [];
  if (attachments.length === 0) return null;

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
  const initialIndex = Math.max(
    0,
    images.findIndex((img) => img.id === attachment.id),
  );

  return (
    <div className="relative flex items-center justify-center gap-2">
      {attachment.type === "image" ? (
        <ImagePreviewDialog
          className="h-12 max-w-48 overflow-hidden rounded-md"
          image={{ src: attachment.url, name: attachment.file.name, size: attachment.file.size }}
          images={images.map((img) => ({ src: img.url, name: img.file.name, size: img.file.size }))}
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
        <span className="line-clamp-1 max-w-[12ch]" title={attachment.file.name}>
          {attachment.file.name}
        </span>

        <div className="flex items-center justify-between gap-2">
          <span className="w-max">{format.size(attachment.file.size)}</span>
          <button
            className="flex w-10 cursor-pointer items-center justify-center rounded-md border border-destructive bg-destructive/60 p-0"
            onMouseDown={() => chatStoreActions.removeAttachment(attachment.id)}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
