import { useRef } from "react";
import { toast } from "@/components/ui/toast";

import { useConfigStore } from "@/components/provider/config-provider";
import { getAttachmentRejectionMessage, prepareAttachmentsForModel } from "@/lib/chat/attachments";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

export function GlobalDropzone({ children, ...props }: React.ComponentPropsWithoutRef<"main">) {
  const dragCounterRef = useRef<number>(0);
  const model = useConfigStore((state) => state.model);

  function handleAddAttachments(files: Array<File>) {
    const editMessage = useChatStore.getState().editMessage;
    const modelId = editMessage?.model ?? model;
    const { attachments, rejectedCount } = prepareAttachmentsForModel(files, modelId);

    if (attachments.length > 0) {
      if (editMessage) {
        chatStoreActions.addEditAttachments(attachments);
      } else {
        chatStoreActions.addAttachments(attachments);
      }
    }

    if (rejectedCount > 0) {
      toast.error("File type not supported", {
        description: getAttachmentRejectionMessage(modelId),
      });
    }
  }

  return (
    <main
      {...props}
      onDragEnter={(event) => {
        const types = event.dataTransfer?.types ?? [];
        const draggingFiles = Array.from(types).includes("Files");

        if (!draggingFiles) return;
        dragCounterRef.current += 1;
        chatStoreActions.setIsDragOver(true);
      }}
      onDragOver={(event) => {
        const types = event.dataTransfer?.types ?? [];
        const draggingFiles = Array.from(types).includes("Files");

        if (!draggingFiles) return;
        event.preventDefault();
        if (!useChatStore.getState().isDragOver) chatStoreActions.setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        const types = event.dataTransfer?.types ?? [];
        const draggingFiles = Array.from(types).includes("Files");

        if (!draggingFiles) return;
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) chatStoreActions.setIsDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();

        const files = Array.from(event.dataTransfer.files ?? []);
        dragCounterRef.current = 0;
        chatStoreActions.setIsDragOver(false);

        if (files.length > 0) handleAddAttachments(files);
      }}
    >
      {children}

      <GlobalDropzoneOverlay />
    </main>
  );
}

function GlobalDropzoneOverlay() {
  const isDragOver = useChatStore((state) => state.isDragOver);

  return (
    <div
      aria-hidden="true"
      data-active={isDragOver}
      className="group pointer-events-none absolute inset-0 z-5 flex items-center justify-center"
    >
      <div className="m-2 flex size-[calc(100%-1rem)] items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 text-primary opacity-0 transition-opacity duration-150 group-data-[active=true]:opacity-100">
        <span className="rounded-md border bg-background/80 px-3 py-1 text-sm">Drop files to attach</span>
      </div>
    </div>
  );
}
