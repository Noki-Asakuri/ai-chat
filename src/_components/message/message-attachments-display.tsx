import type { FileUIPart } from "ai";
import { BotIcon, FileTextIcon } from "lucide-react";

import { extractNameFromUrl, ImageLightboxProvider, ImageLightboxTrigger } from "../image-lightbox";

import { buildAttachmentUrl, buildImageThumbnailUrl, toRawFileUrl } from "@/lib/assets/urls";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatFilePart = ChatMessage["parts"][number] & FileUIPart;

type MessageAttachmentsDisplayProps = React.ComponentPropsWithoutRef<"div"> & {
  messageId: string;
  role: ChatMessage["role"];
  parts: ChatFilePart[];
  attachments: ChatMessage["attachments"];
};

const MESSAGE_THUMBNAIL_TRANSFORM = "tr=w-320,h-320,c-at_max,f-auto,q-70";
const MESSAGE_ATTACHMENT_SIZE_PX = 160;

function getAttachmentThumbnailUrl(url: string): string {
  return buildImageThumbnailUrl(url, MESSAGE_THUMBNAIL_TRANSFORM);
}

export function MessageAttachmentsDisplay({
  messageId,
  parts,
  attachments,
  role,
  className,
  ...props
}: MessageAttachmentsDisplayProps) {
  if (parts.length === 0) return null;

  const attachmentBytesByUrl = new Map<string, number>();
  for (const attachment of attachments) {
    const attachmentUrl = buildAttachmentUrl(attachment.path, attachment.mimeType);
    attachmentBytesByUrl.set(attachmentUrl, attachment.size);
  }

  const imageParts = parts.filter((part) => part.mediaType.includes("image"));
  const imageIndexByUrl = new Map<string, number>();
  const images = imageParts.map((part, index) => {
    const fullImageUrl = toRawFileUrl(part.url);
    const bytes = attachmentBytesByUrl.get(part.url);

    imageIndexByUrl.set(part.url, index);

    return {
      src: fullImageUrl,
      thumbnailSrc: getAttachmentThumbnailUrl(part.url),
      downloadSrc: fullImageUrl,
      alt: part.url,
      name: extractNameFromUrl(part.url),
      bytes,
    };
  });

  return (
    <div className={cn("flex max-w-full flex-col gap-2", className)} {...props}>
      {role === "assistant" && (
        <div className="flex w-max items-center gap-2 rounded-md bg-card px-2 py-1 text-sm text-foreground">
          <BotIcon />
          <span>AI generated</span>
        </div>
      )}

      <div className="flex max-w-full gap-2 overflow-x-auto">
        <ImageLightboxProvider images={images}>
          {parts.map((part, index) => {
            const isImage = part.mediaType.includes("image");

            if (!isImage) {
              return (
                <div
                  key={`${messageId}-attachment-${index}`}
                  className="flex aspect-square size-full items-center justify-center bg-card"
                >
                  <FileTextIcon />
                </div>
              );
            }

            const imageIndex = imageIndexByUrl.get(part.url) ?? -1;
            const thumbnailUrl = getAttachmentThumbnailUrl(part.url);

            if (imageIndex < 0) {
              return (
                <div
                  key={`${messageId}-attachment-${index}`}
                  className="size-40 overflow-hidden rounded-md"
                >
                  <img
                    src={thumbnailUrl}
                    alt={extractNameFromUrl(part.url)}
                    className="aspect-square size-full object-cover object-center"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    width={MESSAGE_ATTACHMENT_SIZE_PX}
                    height={MESSAGE_ATTACHMENT_SIZE_PX}
                  />
                </div>
              );
            }

            return (
              <ImageLightboxTrigger index={imageIndex} key={`${messageId}-attachment-${index}`}>
                <div className="size-40 overflow-hidden rounded-md">
                  <img
                    src={thumbnailUrl}
                    alt={extractNameFromUrl(part.url)}
                    className="aspect-square size-full object-cover object-center"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    width={MESSAGE_ATTACHMENT_SIZE_PX}
                    height={MESSAGE_ATTACHMENT_SIZE_PX}
                  />
                </div>
              </ImageLightboxTrigger>
            );
          })}
        </ImageLightboxProvider>
      </div>
    </div>
  );
}
