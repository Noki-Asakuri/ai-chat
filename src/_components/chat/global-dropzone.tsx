import { useRef } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import type { UserAttachment } from "@/lib/types";

export function GlobalDropzone({ children, ...props }: React.ComponentPropsWithoutRef<"main">) {
  const dragCounterRef = useRef<number>(0);

  function handleAddAttachments(files: Array<File>) {
    const acceptFiles = files.filter(
      (file) => file.type.includes("image") || file.type.includes("pdf"),
    );

    if (acceptFiles.length > 0) {
      const attachments = acceptFiles.map((file): UserAttachment => {
        return { id: uuidv4(), file, type: file.type.includes("image") ? "image" : "pdf" };
      });

      chatStoreActions.addAttachments(attachments);
    }

    if (acceptFiles.length < files.length) {
      toast.error("File type not supported", {
        description: "Please upload an image or PDF file.",
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
      <div className="m-2 flex h-[calc(100%-1rem)] w-[calc(100%-1rem)] items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 text-primary opacity-0 transition-opacity duration-150 group-data-[active=true]:opacity-100">
        <span className="rounded-md border bg-background/80 px-3 py-1 text-sm">
          Drop files to attach
        </span>
      </div>
    </div>
  );
}
