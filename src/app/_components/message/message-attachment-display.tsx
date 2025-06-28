import type { Doc } from "@/convex/_generated/dataModel";

import { Dialog } from "@base-ui-components/react/dialog";
import { FileIcon } from "lucide-react";

import type { ChatMessage } from "@/lib/types";
import { format } from "@/lib/utils";

export function MessageAttachmentDisplay({ message }: { message: ChatMessage }) {
  if (!message.attachments || message.attachments.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Attachments"
      className="flex flex-wrap items-center justify-start gap-2"
    >
      {message.attachments.map((attachment) => (
        <AttachmentPreview key={attachment._id} attachment={attachment} />
      ))}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Doc<"attachments"> }) {
  const attachmentUrl = `https://files.chat.asakuri.me/${attachment.userId}/${attachment.threadId}/${attachment._id}`;

  if (attachment.type === "image") {
    return (
      <Dialog.Root>
        <Dialog.Trigger className="aspect-square size-40 overflow-hidden rounded-md">
          <img alt="Attachment" className="size-full object-cover" src={attachmentUrl} />
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />

          <Dialog.Popup className="pointer-events-none fixed top-1/2 left-1/2 z-50 -mt-8 flex w-max max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-2 transition-all duration-150 outline-none data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
            <img
              alt="Attachment"
              className="pointer-events-auto max-h-[80vh] rounded-lg object-center"
              src={attachmentUrl}
            />

            <div className="pointer-events-auto flex flex-col items-center justify-center gap-1 text-sm">
              <span>Name: {attachment.name}</span>
              <span>Size: {format.size(attachment.size)}</span>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (attachment.type === "pdf" || attachment.type === "doc") {
    return (
      <a
        href={attachmentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-40 flex-col items-center justify-center gap-2 rounded-md border p-2"
      >
        <FileIcon className="size-8" />

        <div className="flex w-full flex-col gap-1 text-center">
          <span className="truncate text-sm">{attachment.name}</span>
          <span className="text-xs">{format.size(attachment.size)}</span>
        </div>
      </a>
    );
  }

  return null;
}
