import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { FileIcon, FileTextIcon } from "lucide-react";

import { buildAttachmentUrl, buildImageThumbnailUrl } from "@/lib/assets/urls";
import { cn } from "@/lib/utils";

const CHIP_THUMBNAIL_TRANSFORM = "tr=w-64,h-64,c-at_max,f-auto,q-70";

export const tokenChipClassName = cn(
  "mx-px inline-flex h-[1.5em] max-w-[24ch] items-center gap-1 rounded-[0.35rem] px-1.5 align-middle text-[0.9em] leading-none font-medium whitespace-nowrap select-none",
  "ring-1 transition-[box-shadow,background-color] ring-inset data-selected:ring-2 data-pending:animate-pulse",
);

export const fileChipClassName = cn(
  tokenChipClassName,
  "bg-muted text-foreground ring-border data-selected:ring-primary",
);

export const profileChipClassName = cn(
  tokenChipClassName,
  "bg-primary/12 text-primary ring-primary/30 data-selected:ring-primary",
);

type GlyphAttachment = Pick<Doc<"attachments">, "type" | "path" | "mimeType">;

export function AttachmentGlyph({
  attachment,
  className,
  iconClassName,
}: {
  attachment?: GlyphAttachment;
  className?: string;
  iconClassName?: string;
}) {
  if (attachment?.type === "image") {
    const url = buildImageThumbnailUrl(
      buildAttachmentUrl(attachment.path, attachment.mimeType),
      CHIP_THUMBNAIL_TRANSFORM,
    );
    return <img src={url} alt="" className={cn("shrink-0 object-cover", className)} />;
  }

  if (attachment?.type === "pdf") {
    return <FileTextIcon aria-hidden="true" className={cn("shrink-0", iconClassName)} />;
  }

  return <FileIcon aria-hidden="true" className={cn("shrink-0", iconClassName)} />;
}

export function FileChipContent({ label, attachment }: { label: string; attachment?: GlyphAttachment }) {
  return (
    <>
      <AttachmentGlyph
        attachment={attachment}
        className="size-[1.05em] rounded-[0.2rem]"
        iconClassName="size-[1em] text-muted-foreground"
      />
      <span className="truncate">{label}</span>
    </>
  );
}
