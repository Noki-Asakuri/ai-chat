import { PaperclipIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ImageLightboxProvider, ImageLightboxTrigger } from "@/components/image-lightbox";
import { useConfigStore } from "@/components/provider/config-provider";
import { ButtonWithTip } from "@/components/ui/button";

import { getModelData } from "@/lib/chat/models";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { format } from "@/lib/utils";

export function ChatAttachmentsButton() {
  const model = useConfigStore((state) => state.model);
  const hasImageVision = getModelData(model).capabilities.vision;

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

type Preview = { id: string; type: "image" | "pdf"; file: File; url: string };

export function ChatAttachmentsDisplay() {
  const attachments = useChatStore((state) => state.attachments);
  const [preview, setPreview] = useState<Preview[]>([]);

  useEffect(() => {
    if (!attachments.length) {
      setPreview([]);
      return;
    }

    const preview = attachments.map(({ id, type, file }): Preview => {
      return { id, type, file, url: URL.createObjectURL(file) };
    });

    setPreview(preview);

    return () => {
      for (const p of preview) URL.revokeObjectURL(p.url);
    };
  }, [attachments]);

  const imageList = preview.filter((p) => p.type === "image");
  if (attachments.length === 0) return null;

  return (
    <div
      data-visible={!!preview}
      data-slot="attachment-display"
      className="custom-scroll flex items-center justify-start gap-2 overflow-x-auto border-b p-2.5 data-[visible=false]:hidden"
    >
      <ImageLightboxProvider
        images={imageList.map((p) => ({ src: p.url, name: p.file.name, bytes: p.file.size }))}
      >
        {preview.map((attachment) => (
          <AttachmentPreview key={attachment.id} attachment={attachment} images={imageList} />
        ))}
      </ImageLightboxProvider>
    </div>
  );
}

function AttachmentPreview({ attachment, images }: { attachment: Preview; images: Preview[] }) {
  const index = images.findIndex((p) => p.id === attachment.id);

  return (
    <div className="group relative flex justify-center gap-2 rounded-md border border-border bg-background/50 p-2 transition-colors hover:bg-foreground/10">
      <ImageLightboxTrigger index={index} type="button" className="overflow-hidden rounded-md">
        <img
          src={attachment.url}
          alt={attachment.file.name}
          className="aspect-square size-15 object-cover object-center"
        />
      </ImageLightboxTrigger>

      <button
        type="button"
        title={`Remove ${attachment.file.name}`}
        className="absolute -top-2 -right-2 isolate rounded-md border bg-background p-1 text-destructive transition-colors hover:bg-foreground/20"
        onClick={() => chatStoreActions.removeAttachment(attachment.id)}
      >
        <TrashIcon size={16} />
        <span className="sr-only">Remove {attachment.file.name}</span>
      </button>

      <div className="self-center">
        <p className="max-w-[15ch] truncate text-sm">{attachment.file.name}</p>
        <p className="text-xs text-muted-foreground">{format.size(attachment.file.size)}</p>
      </div>
    </div>
  );
}
