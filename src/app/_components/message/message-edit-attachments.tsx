"use client";

import { FileIcon, XIcon } from "lucide-react";
import * as React from "react";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { UserAttachment } from "@/lib/types";

import { cn, format } from "@/lib/utils";
import { getModelData } from "@/lib/chat/models";

type Existing = Doc<"attachments">;

type MessageEditAttachmentsProps = {
  existing: Array<Existing>;
  removed: Set<Id<"attachments">>;
  onToggleRemove: (id: Id<"attachments">) => void;

  newFiles: Array<UserAttachment>;
  onAddFiles: (files: Array<File>) => void;
  onRemoveNew: (id: string) => void;

  modelId: string;
  userId: string;
  threadId: Id<"threads">;
};

type LocalPreview = {
  id: string;
  type: "image" | "pdf";
  url: string;
  name: string;
  size: number;
};

type RemotePreview = {
  _id: Id<"attachments">;
  type: "image" | "pdf";
  url: string;
  name: string;
  size: number;
};

function useLocalPreviews(files: Array<UserAttachment>) {
  const [previews, setPreviews] = React.useState<Array<LocalPreview>>([]);

  React.useEffect(() => {
    if (!files.length) {
      setPreviews([]);
      return;
    }
    const next = files.map((f) => {
      const objectUrl = URL.createObjectURL(f.file);
      const p: LocalPreview = {
        id: f.id,
        url: objectUrl,
        name: f.name,
        size: f.size,
        type: f.type,
      };
      return p;
    });
    setPreviews(next);

    return () => {
      next.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [files]);

  return previews;
}

function useRemotePreviews(
  existing: Array<Existing>,
  removed: Set<Id<"attachments">>,
  userId: string,
  threadId: Id<"threads">,
) {
  return React.useMemo(() => {
    const list: Array<RemotePreview> = [];
    for (const a of existing) {
      if (removed.has(a._id)) continue;
      const url = `https://files.chat.asakuri.me/${userId}/${threadId}/${a._id}`;
      list.push({ _id: a._id, type: a.type, url, name: a.name, size: a.size });
    }
    return list;
  }, [existing, removed, userId, threadId]);
}

export function MessageEditAttachments(props: MessageEditAttachmentsProps) {
  const hasImageVision = getModelData(props.modelId)?.capabilities.vision ?? false;

  const localPreviews = useLocalPreviews(props.newFiles);
  const remotePreviews = useRemotePreviews(
    props.existing,
    props.removed,
    props.userId,
    props.threadId,
  );

  const hasAny = localPreviews.length > 0 || remotePreviews.length > 0;
  // If there are no previews and the model doesn't support vision uploads, skip the whole section
  if (!hasAny && !hasImageVision) return null;

  function onFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    props.onAddFiles([file]);
    // clear value to allow uploading the same file again
    event.currentTarget.value = "";
  }

  return (
    <div className={cn("flex flex-col gap-2 border-b p-2.5", { hidden: !hasAny && hasImageVision })}>
      {/* Previews */}
      {hasAny && (
        <div className="flex flex-wrap items-center justify-start gap-4">
          {remotePreviews.map((att) => (
            <div key={att._id} className="relative flex items-center justify-center gap-2">
              {att.type === "image" ? (
                <img src={att.url} alt="Attachment" className="h-12 rounded-md object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-200">
                  <FileIcon className="size-6" />
                </div>
              )}

              <div className="flex flex-col gap-0.5">
                <span className="line-clamp-1 max-w-[12ch]" title={att.name}>
                  {att.name}
                </span>

                <div className="flex items-center justify-between gap-2">
                  <span>{format.size(att.size)}</span>
                  <button
                    type="button"
                    className="border-destructive bg-destructive/60 flex w-10 cursor-pointer items-center justify-center rounded-md border p-0"
                    onMouseDown={() => props.onToggleRemove(att._id)}
                    title="Remove existing attachment"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {localPreviews.map((att) => (
            <div key={att.id} className="relative flex items-center justify-center gap-2">
              {att.type === "image" ? (
                <img src={att.url} alt="Attachment" className="h-12 rounded-md object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-200">
                  <FileIcon className="size-6" />
                </div>
              )}

              <div className="flex flex-col gap-0.5">
                <span className="line-clamp-1 max-w-[12ch]" title={att.name}>
                  {att.name}
                </span>

                <div className="flex items-center justify-between gap-2">
                  <span>{format.size(att.size)}</span>
                  <button
                    type="button"
                    className="border-destructive bg-destructive/60 flex w-10 cursor-pointer items-center justify-center rounded-md border p-0"
                    onMouseDown={() => props.onRemoveNew(att.id)}
                    title="Remove uploaded file"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}