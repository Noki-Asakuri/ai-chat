import { UploadIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ButtonWithTip } from "../ui/button";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn, format } from "@/lib/utils";

export function ChatAttachmentButton() {
  const model = useChatStore((state) => state.chatConfig.model);
  const addAttachment = useChatStore((state) => state.addAttachment);

  const hasImageVision = getModelData(model)?.capabilities.vision;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files![0];
    if (!file) return;

    addAttachment([{ id: uuidv4(), type: "image", name: file.name, size: file.size, file }]);
  }

  if (!hasImageVision) return null;

  return (
    <>
      <ButtonWithTip title="Upload Image" variant="outline" className="size-9 gap-2" asChild>
        <label htmlFor="image-upload" className="cursor-pointer">
          <UploadIcon />
        </label>
      </ButtonWithTip>

      <input
        id="image-upload"
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}

type Preview = { id: string; url: string; name: string; size: number };

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
      };
      return preview;
    });
    setPreview(preview);

    return () => {
      preview.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  if (attachments.length === 0) return null;

  return (
    <div className={cn("flex items-center justify-start gap-4", { hidden: !preview })}>
      {preview?.map((attachment) => (
        <AttachmentPreview key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Preview }) {
  const removeAttachment = useChatStore((state) => state.removeAttachment);

  return (
    <div className="relative flex items-center justify-center gap-2">
      <img src={attachment.url} alt="Attachment" className="h-12 rounded-md object-contain" />
      <div className="flex flex-col gap-0.5">
        <span className="line-clamp-1 max-w-[12ch]" title={attachment.name}>
          {attachment.name}
        </span>

        <div className="flex items-center justify-between gap-2">
          <span>{format.size(attachment.size / 1024)}</span>
          <button
            className="border-destructive bg-destructive/60 flex w-10 cursor-pointer items-center justify-center rounded-md border p-0"
            onMouseDown={() => removeAttachment(attachment.id)}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
