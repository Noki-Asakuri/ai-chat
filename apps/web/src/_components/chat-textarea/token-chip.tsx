import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { FileIcon, FileTextIcon } from "lucide-react";
import { useCallback } from "react";

import { buildAttachmentUrl, buildImageThumbnailUrl } from "@/lib/assets/urls";
import type { UserAttachment } from "@/lib/types";
import { cn, format } from "@/lib/utils";

const CHIP_THUMBNAIL_TRANSFORM = "tr=w-64,h-64,c-at_max,f-auto,q-70";

export const tokenChipClassName = cn(
  "mx-px inline-flex h-[1.5em] max-w-[32ch] items-center gap-1 rounded-[0.35rem] px-1.5 align-middle text-[0.9em] leading-none font-medium whitespace-nowrap select-none",
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

const chipGlyphClassName = "size-[1.05em] rounded-[0.2rem]";
const chipIconClassName = "size-[1em] text-muted-foreground";

function ChipSize({ bytes }: { bytes?: number }) {
  if (bytes === undefined) return null;

  return (
    <span className="shrink-0 text-[0.8em] font-normal text-muted-foreground tabular-nums">
      {format.size(bytes)}
    </span>
  );
}

export function FileChipContent({
  label,
  attachment,
  size,
}: {
  label: string;
  attachment?: GlyphAttachment;
  size?: number;
}) {
  return (
    <>
      <AttachmentGlyph
        attachment={attachment}
        className={chipGlyphClassName}
        iconClassName={chipIconClassName}
      />
      <span className="truncate">{label}</span>
      <ChipSize bytes={size} />
    </>
  );
}

/** A chip for a file in the composer's tray, not uploaded yet, previewed from the local file. */
export function UploadChipContent({ label, upload }: { label: string; upload: UserAttachment }) {
  return (
    <>
      {upload.type === "image" ? (
        <LocalImagePreview file={upload.file} />
      ) : (
        <FileTextIcon aria-hidden="true" className={cn("shrink-0", chipIconClassName)} />
      )}
      <span className="truncate">{label}</span>
      <ChipSize bytes={upload.file.size} />
    </>
  );
}

// One preview URL per file, shared by every chip of it, and revoked once the last one is gone.
const previewUrls = new WeakMap<File, { url: string; users: number }>();

type SharedPreview = { url: string; release: () => void };

function acquirePreviewUrl(file: File): SharedPreview {
  const preview = previewUrls.get(file) ?? { url: URL.createObjectURL(file), users: 0 };
  preview.users += 1;
  previewUrls.set(file, preview);

  return {
    url: preview.url,
    release: () => {
      preview.users -= 1;
      if (preview.users > 0) return;
      URL.revokeObjectURL(preview.url);
      previewUrls.delete(file);
    },
  };
}

function LocalImagePreview({ file }: { file: File }) {
  const attachPreview = useCallback(
    (image: HTMLImageElement) => {
      const preview = acquirePreviewUrl(file);
      image.src = preview.url;
      return preview.release;
    },
    [file],
  );

  return <img ref={attachPreview} alt="" className={cn("shrink-0 object-cover", chipGlyphClassName)} />;
}
