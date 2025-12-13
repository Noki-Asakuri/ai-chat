import type { FileUIPart } from "ai";
import { BotIcon, FileTextIcon } from "lucide-react";

import { extractNameFromUrl, ImageLightboxProvider, ImageLightboxTrigger } from "../image-lightbox";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageAttachmentsDisplayProps = React.ComponentPropsWithoutRef<"div"> & {
  messageId: string;
  role: ChatMessage["role"];
  parts: FileUIPart[];
};

export function MessageAttachmentsDisplay({
  messageId,
  parts,
  role,
  className,
  ...props
}: MessageAttachmentsDisplayProps) {
  if (parts.length === 0) return null;

  const images = parts
    .filter((p) => p.mediaType.includes("image"))
    .map((p) => ({ src: p.url, alt: p.url, name: extractNameFromUrl(p.url), size: 0 }));

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {role === "assistant" && (
        <div className="flex w-max items-center gap-2 rounded-md bg-card px-2 py-1 text-sm text-foreground">
          <BotIcon />
          <span>AI generated</span>
        </div>
      )}

      <div className="flex gap-2">
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

            const imageIndex = images.findIndex((i) => i.src === part.url);

            return (
              <ImageLightboxTrigger index={imageIndex} key={`${messageId}-attachment-${index}`}>
                <div className="size-40 overflow-hidden rounded-md">
                  <img
                    src={part.url}
                    alt={extractNameFromUrl(part.url)}
                    className="aspect-square size-full object-cover object-center"
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
