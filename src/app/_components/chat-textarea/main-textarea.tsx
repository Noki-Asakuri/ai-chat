import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { ScrollButton } from "./scroll-group-button";
import { Textarea } from "../ui/textarea";

import { ChatActionButtons } from "./action-buttons";
import { ChatAttachmentDisplay } from "./attachment-display";
import { ChatSendButton } from "./send-button";

import { useChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ChatTextarea() {
  const parentRef = useRef<HTMLDivElement>(null);

  const setTextareaHeight = useChatStore((state) => state.setTextareaHeight);
  const isDragOver = useChatStore((state) => state.isDragOver);

  const onResize = useCallback(
    (entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      setTextareaHeight(entry.target.clientHeight);
    },
    [setTextareaHeight],
  );

  useEffect(() => {
    if (!parentRef.current) return;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(parentRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, [onResize]);

  return (
    <div className="pointer-events-none absolute bottom-2 w-full px-4" ref={parentRef}>
      <form className="mx-auto space-y-2">
        <ScrollButton />

        <div className="bg-muted/40 group-data-[disable-blur=true]/sidebar-provider:bg-muted pointer-events-auto mx-auto max-w-4xl space-y-2 rounded-md border backdrop-blur-md backdrop-saturate-150">
          <UsageBanner />
          <ChatAttachmentDisplay />

          <div
            data-dragover={isDragOver}
            className={cn(
              "data-[dragover=true]:bg-primary/20 data-[dragover=true]:border-primary/40",
              "group-data-[disable-blur=true]/sidebar-provider:bg-transparent",
            )}
          >
            <InputTextArea />

            <div className="flex items-end justify-between border-t px-2.5 py-2">
              <ChatActionButtons />
              <ChatSendButton />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function InputTextArea() {
  const input = useChatStore((state) => state.chatInput);
  const { submitChatMessage } = useChatRequest();

  const setChatInput = useChatStore((state) => state.setChatInput);
  const addAttachment = useChatStore((state) => state.addAttachment);
  const setIsDragOver = useChatStore((state) => state.setIsDragOver);

  function handleAddAttachments({ files }: { files: File[] }) {
    const acceptFiles = files.filter(
      (file) => file.type.includes("image") || file.type.includes("pdf"),
    );

    if (acceptFiles.length > 0) {
      const attachments = acceptFiles.map((file) => {
        let type: "image" | "pdf" = "image";
        if (file.type.includes("pdf")) type = "pdf";

        return { id: uuidv4(), name: file.name, size: file.size, file, type };
      });

      addAttachment(attachments);
    }

    if (acceptFiles.length < files.length) {
      toast.error("File type not supported", {
        description: "Please upload an image or PDF file.",
      });
    }
  }

  return (
    <div className="flex flex-grow flex-row items-start p-2.5">
      <Textarea
        rows={3}
        name="user-input"
        id="textarea-chat-input"
        autoComplete="off"
        aria-multiline="true"
        aria-autocomplete="none"
        aria-describedby="textarea-description"
        aria-label="Type your message here..."
        placeholder="Type your message here..."
        value={input}
        onChange={(event) => setChatInput(event.target.value)}
        className="max-h-[250px] w-full resize-none rounded-none border-0 !bg-transparent p-0 !ring-0"
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);

          handleAddAttachments({ files: Array.from(event.dataTransfer.files) });
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => {
          setIsDragOver(false);
        }}
        onPaste={(event) => {
          const { items } = event.clipboardData;
          const files = Array.from(items)
            .filter((item) => item.kind === "file")
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);

          if (files.length === 0) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          handleAddAttachments({ files });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (!event.shiftKey || event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submitChatMessage();
          }
        }}
      />

      <span id="textarea-description" className="sr-only">
        Press enter to send message. Shift + enter or Ctrl + enter to add new line.
      </span>
    </div>
  );
}

function UsageBanner() {
  const { data, isPending } = useQuery(convexQuery(api.functions.usages.getUsage, {}));
  if (isPending || !data || data.used < data.base) return null;

  const date = new Date(data.resetAt);
  const resetStr = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  return (
    <div className="border-b text-sm">
      <div className="px-2.5 py-2">
        Monthly usage:{" "}
        <span className="font-medium">
          {data.used} / {data.base}
        </span>
        . Resets on <span className="font-medium">{resetStr}</span>.
      </div>
    </div>
  );
}
