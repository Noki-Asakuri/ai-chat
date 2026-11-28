import { PlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ImageLightboxProvider, ImageLightboxTrigger } from "@/components/image-lightbox";
import { useConfigStore } from "@/components/provider/config-provider";
import { ButtonWithTip } from "@/components/ui/button";

import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import type { UserAttachment } from "@/lib/types";
import { cn, format } from "@/lib/utils";

import { composerIconControlClassName } from "./composer-control";
import { keepComposerFocus } from "./keep-composer-focus";
import { useChatAttachmentInput } from "./use-chat-attachment-input";

type BaseChatAttachmentsButtonProps = React.ComponentPropsWithoutRef<typeof ButtonWithTip> & {
  model: string;
  handleAddAttachments: (files: UserAttachment[]) => void;
};

export function BaseChatAttachmentsButton({
  model,
  handleAddAttachments,
  className,
  ...props
}: BaseChatAttachmentsButtonProps) {
  const { accept, handleChange, inputId, supportsAttachments } = useChatAttachmentInput({
    model,
    handleAddAttachments,
  });

  if (!supportsAttachments) return null;

  return (
    <>
      <ButtonWithTip
        onMouseDown={keepComposerFocus}
        {...props}
        variant="ghost"
        title="Upload attachment"
        className={cn(composerIconControlClassName, "shrink-0 p-0!", className)}
      >
        <label htmlFor={inputId} className="flex size-full cursor-pointer items-center justify-center">
          <PlusIcon className="size-4.5" />
          <span className="sr-only">Upload attachment</span>
        </label>
      </ButtonWithTip>

      <input type="file" id={inputId} accept={accept} onChange={handleChange} className="hidden" />
    </>
  );
}

export function ChatAttachmentsButton({ className }: { className?: string }) {
  const model = useConfigStore((state) => state.model);

  return (
    <BaseChatAttachmentsButton
      model={model}
      handleAddAttachments={chatStoreActions.addAttachments}
      className={className}
    />
  );
}

type Preview = { id: string; type: "image" | "pdf"; file: File; url: string };

export function ChatAttachmentsDisplay() {
  const attachments = useChatStore((state) => state.attachments);
  if (attachments.length === 0) return null;

  return (
    <ChatAttachmentPreviews
      key={attachments.map((attachment) => attachment.id).join(":")}
      attachments={attachments}
    />
  );
}

function ChatAttachmentPreviews({ attachments }: { attachments: UserAttachment[] }) {
  const [preview, setPreview] = useState<Preview[]>([]);

  useEffect(() => {
    const nextPreview = attachments.map(({ id, type, file }) => ({
      id,
      type,
      file,
      url: URL.createObjectURL(file),
    }));
    let active = true;
    queueMicrotask(() => {
      if (active) setPreview(nextPreview);
    });

    return () => {
      active = false;
      for (const attachment of nextPreview) URL.revokeObjectURL(attachment.url);
    };
  }, [attachments]);

  const imageList = preview.filter((p) => p.type === "image");

  return (
    <div
      data-visible={!!preview}
      data-slot="attachment-display"
      className="flex items-center justify-start gap-2 overflow-x-auto px-3 pt-3 data-[visible=false]:hidden"
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
    <div className="group relative flex shrink-0 items-center gap-2.5 rounded-xl bg-foreground/5 py-1.5 pr-3 pl-1.5 transition-colors hover:bg-foreground/8">
      <ImageLightboxTrigger index={index} type="button" className="overflow-hidden rounded-lg">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="aspect-square size-10 shrink-0 object-cover object-center"
        />
      </ImageLightboxTrigger>

      <button
        type="button"
        title={`Remove ${attachment.name}`}
        className="absolute -top-1.5 -right-1.5 isolate grid size-5 cursor-pointer place-items-center rounded-full border border-border bg-popover text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
        onClick={() => removeAttachment(attachment.id)}
      >
        <XIcon size={12} />
        <span className="sr-only">Remove {attachment.name}</span>
      </button>

      <div className="min-w-0">
        <p className="max-w-[18ch] truncate text-xs leading-tight">{attachment.name}</p>
        <p className="text-2xs text-muted-foreground">{format.size(attachment.size)}</p>
      </div>
    </div>
  );
}
