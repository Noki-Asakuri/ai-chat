"use client";

import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ScrollButton } from "../scroll-button";
import { Textarea } from "../ui/textarea";

import { ChatActionButtons } from "./chat-action-buttons";
import { ChatAttachmentDisplay } from "./chat-attachment-display";
import { ChatSendButton } from "./chat-send-button";

import { submitChatMessage } from "@/lib/chat/send-chat-request";
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
    <form className="absolute bottom-0 w-full px-4">
      <ScrollButton />

      <div
        ref={parentRef}
        className={cn([
          "mx-auto max-w-4xl space-y-2 rounded-[calc(var(--spacing)*2+calc(var(--radius)-2px))] rounded-b-none border border-b-0 p-2 pb-0",
          "bg-muted/40 backdrop-blur-md backdrop-saturate-150",
        ])}
      >
        <ChatAttachmentDisplay />

        <div
          data-dragover={isDragOver}
          className={cn(
            "bg-muted/60 border-border rounded-md rounded-b-none border border-b-0 p-2.5 pb-0",
            "data-[dragover=true]:bg-primary/20 data-[dragover=true]:border-primary/40",
          )}
        >
          <InputTextArea />

          <div className="flex items-end justify-between py-2">
            <ChatActionButtons />
            <ChatSendButton />
          </div>
        </div>
      </div>
    </form>
  );
}

function InputTextArea() {
  const navigate = useNavigate();

  const input = useChatStore((state) => state.chatInput);
  const setChatInput = useChatStore((state) => state.setChatInput);
  const addAttachment = useChatStore((state) => state.addAttachment);

  const setIsDragOver = useChatStore((state) => state.setIsDragOver);

  return (
    <div className="flex flex-grow flex-row items-start">
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
          const { files } = event.dataTransfer;
          const acceptedFiles = Array.from(files).filter(
            (file) => file.type.includes("image") || file.type.includes("pdf"),
          );

          if (acceptedFiles.length > 0) {
            const attachments = acceptedFiles.map((file) => {
              let type: "image" | "pdf" = "image";
              if (file.type.includes("pdf")) {
                type = "pdf";
              }
              return { id: crypto.randomUUID(), name: file.name, size: file.size, file, type };
            });
            addAttachment(attachments);
          } else {
            toast.error("File type not supported", {
              description: "Please upload an image or PDF file.",
            });
          }
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
          const hasFiles = Array.from(items).some((item) => item.kind === "file");
          const acceptedFiles = Array.from(items).filter(
            (item) => item.type.includes("image") || item.type.includes("pdf"),
          );

          if (acceptedFiles.length > 0) {
            event.preventDefault();
            const files = acceptedFiles.map((item) => {
              const file = item.getAsFile();
              if (!file) throw new Error("Failed to get file from item");

              let type: "image" | "pdf" = "image";
              if (item.type.includes("pdf")) {
                type = "pdf";
              }

              return { id: crypto.randomUUID(), name: file.name, size: file.size, file, type };
            });
            addAttachment(files);
          } else if (hasFiles) {
            event.preventDefault();
            toast.error("File type not supported", {
              description: "Please paste an image or PDF file.",
            });
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (!event.shiftKey || event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submitChatMessage({ navigate });
          }
        }}
      />
      <span id="textarea-description" className="sr-only">
        Press enter to send message. Shift + enter or Ctrl + enter to add new line.
      </span>
    </div>
  );
}
