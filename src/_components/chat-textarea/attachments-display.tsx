import { PaperclipIcon, TrashIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ImageLightboxProvider, ImageLightboxTrigger } from "@/components/image-lightbox";
import { useConfigStore } from "@/components/provider/config-provider";
import { ButtonWithTip } from "@/components/ui/button";

import { getModelData } from "@/lib/chat/models";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import type { UserAttachment } from "@/lib/types";
import { format } from "@/lib/utils";

type BaseChatAttachmentsButtonProps = React.ComponentPropsWithoutRef<typeof ButtonWithTip> & {
  model: string;
  handleAddAttachments: (files: UserAttachment[]) => void;
};

export function BaseChatAttachmentsButton({
  model,
  handleAddAttachments,
  ...props
}: BaseChatAttachmentsButtonProps) {
  const hasImageVision = getModelData(model).capabilities.vision;
  if (!hasImageVision) return null;

  const inputId = useId();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    let type: "image" | "pdf" = "image";
    if (file.type.includes("pdf")) type = "pdf";

    handleAddAttachments([{ id: uuidv4(), type, file }]);

    // allow re-uploading the same file
    event.target.value = "";
  }

  return (
    <>
      <ButtonWithTip
        {...props}
        variant="ghost"
        title="Upload attachment"
        className="size-9 border p-0! px-2 py-1.5 text-xs"
        type="button"
      >
        <label
          htmlFor={inputId}
          className="flex size-full cursor-pointer items-center justify-center"
        >
          <PaperclipIcon />
          <span className="sr-only">Upload attachment</span>
        </label>
      </ButtonWithTip>

      <input
        type="file"
        id={inputId}
        accept="image/*,application/pdf"
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}

export function ChatAttachmentsButton() {
  const model = useConfigStore((state) => state.model);

  return (
    <BaseChatAttachmentsButton
      model={model}
      handleAddAttachments={chatStoreActions.addAttachments}
    />
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
        {preview.map((attachment) => {
          const index = imageList.findIndex((p) => p.id === attachment.id);

          return (
            <AttachmentPreview
              index={index}
              key={attachment.id}
              removeAttachment={chatStoreActions.removeAttachment}
              attachment={{ ...attachment, name: attachment.file.name, size: attachment.file.size }}
            />
          );
        })}
      </ImageLightboxProvider>
    </div>
  );
}

type AttachmentPreviewProps = {
  index: number;
  removeAttachment: (id: string) => void;
  attachment: { id: string; name: string; size: number; url: string };
};

function AttachmentPreview({ attachment, index, removeAttachment }: AttachmentPreviewProps) {
  return (
    <div className="group relative flex justify-center gap-2 rounded-md border border-border bg-background/50 p-2 transition-colors hover:bg-foreground/10">
      <ImageLightboxTrigger index={index} type="button" className="overflow-hidden rounded-md">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="aspect-square size-15 object-cover object-center"
        />
      </ImageLightboxTrigger>

      <button
        type="button"
        title={`Remove ${attachment.name}`}
        className="absolute -top-2 -right-2 isolate rounded-md border bg-background p-1 text-destructive transition-colors hover:bg-foreground/20"
        onClick={() => removeAttachment(attachment.id)}
      >
        <TrashIcon size={16} />
        <span className="sr-only">Remove {attachment.name}</span>
      </button>

      <div className="self-center">
        <p className="max-w-[15ch] truncate text-sm">{attachment.name}</p>
        <p className="text-xs text-muted-foreground">{format.size(attachment.size)}</p>
      </div>
    </div>
  );
}
