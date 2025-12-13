import { cn } from "@/lib/utils";
import type { FileUIPart } from "ai";
import { FileTextIcon } from "lucide-react";

type MessageAttachmentsDisplayProps = React.ComponentPropsWithoutRef<"div"> & {
  messageId: string;
  parts: FileUIPart[];
};

export function MessageAttachmentsDisplay({
  messageId,
  parts,
  className,
  ...props
}: MessageAttachmentsDisplayProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {parts.map((part, index) => {
        const isImage = part.mediaType.includes("image");

        return (
          <div
            key={`${messageId}-attachment-${index}`}
            className="size-40 overflow-hidden rounded-md"
          >
            {isImage ? (
              <img src={part.url} className="aspect-square size-full object-cover object-center" />
            ) : (
              <div className="flex aspect-square size-full items-center justify-center bg-card">
                <FileTextIcon />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
