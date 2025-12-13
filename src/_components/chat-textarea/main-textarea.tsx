import { api } from "@/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";

import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { Textarea } from "../ui/textarea";

import { ChatActionButtons } from "./action-buttons";
import { ChatAttachmentsDisplay } from "./attachments-display";
import { ChatSendButton } from "./send-button";

import { useGetSendDescription, useShouldSend } from "@/lib/chat/send-preference";
import { useSendChatMessage } from "@/lib/chat/server-function/send-chat-message";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

export function ChatTextarea() {
  const parentRef = useRef<HTMLDivElement>(null);

  const onResize = useEffectEvent((entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) return;

    chatStoreActions.setTextareaHeight(entry.target.clientHeight);
  });

  useEffect(() => {
    if (!parentRef.current) return;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(parentRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={parentRef}
      data-slot="chat-textarea"
      className="pointer-events-none absolute bottom-2 w-full px-4"
    >
      <form className="mx-auto space-y-2">
        <div className="pointer-events-auto mx-auto max-w-4xl space-y-2 rounded-md border bg-background/80 backdrop-blur-md backdrop-saturate-150">
          <UsageBanner />
          <ChatAttachmentsDisplay />

          <div>
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
  const shouldSend = useShouldSend();
  const input = useChatStore((state) => state.input);

  const { sendChatRequest } = useSendChatMessage();

  function handleAddAttachments({ files }: { files: File[] }) {
    const acceptFiles = files.filter(
      (file) => file.type.includes("image") || file.type.includes("pdf"),
    );

    if (acceptFiles.length > 0) {
      const attachments = acceptFiles.map((file) => ({
        id: uuidv4(),
        file,
        type: (file.type.includes("image") ? "image" : "pdf") as "image" | "pdf",
      }));

      chatStoreActions.addAttachments(attachments);
    }

    if (acceptFiles.length < files.length) {
      toast.error("File type not supported", {
        description: "Please upload an image or PDF file.",
      });
    }
  }

  return (
    <div className="flex grow flex-row items-start p-2.5">
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
        onChange={(event) => chatStoreActions.setInput(event.target.value)}
        data-slot="textarea-chat-input"
        className="max-h-62.5 w-full resize-none rounded-none border-0 bg-transparent! p-0 ring-0!"
        onPaste={(event) => {
          const { items } = event.clipboardData;
          const files = Array.from(items)
            .filter((item) => item.kind === "file")
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);

          if (files.length === 0) return;

          event.preventDefault();
          event.stopPropagation();

          handleAddAttachments({ files });
        }}
        onKeyDown={(event) => {
          const send = shouldSend({
            key: event.key,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          });

          if (!send) return;

          event.preventDefault();
          sendChatRequest();
        }}
      />

      <TextareaDescription />
    </div>
  );
}

function TextareaDescription() {
  const sendDescription = useGetSendDescription();

  return (
    <span id="textarea-description" className="sr-only">
      {sendDescription}
    </span>
  );
}

function getResetDate(type: "monthly" | "daily"): string {
  const dateNow = Date.now();

  switch (type) {
    case "monthly": {
      const date = new Date(dateNow);
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);

      return date.toISOString();
    }

    case "daily": {
      const date = new Date(dateNow);
      date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);

      return date.toISOString();
    }
  }
}

function UsageBanner() {
  const { data, isPending } = useQuery(convexSessionQuery(api.functions.usages.getUserUsages));
  if (isPending || !data || data.used < data.base) return null;

  const resetStr = getResetDate(data.resetType ?? "monthly");

  return (
    <div className="border-b text-sm">
      <div className="px-2.5 py-2">
        {data.resetType === "monthly" ? "Monthly" : "Daily"} usage:{" "}
        <span className="font-medium">
          {data.used} / {data.base}
        </span>
        . Resets on <span className="font-medium">{resetStr}</span>.
      </div>
    </div>
  );
}
