"use client";

import { useRouter } from "next/navigation";

import { useEffect, useRef } from "react";

import { ScrollButton } from "../scroll-button";
import { Textarea } from "../ui/textarea";

import { ChatActionButtons } from "./chat-action-buttons";
import { ChatAttachmentDisplay } from "./chat-attachment-display";
import { ChatSendButton } from "./chat-send-button";

import { submitChatMessage } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";

export function ChatTextarea() {
  const setTextareaHeight = useChatStore((state) => state.setTextareaHeight);
  const parentRef = useRef<HTMLDivElement>(null);

  function onResize(entries: ResizeObserverEntry[]) {
    const entry = entries[0];
    if (!entry) return;

    setTextareaHeight(entry.target.clientHeight);
  }

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
    <form className="absolute bottom-0 w-full px-4">
      <ScrollButton />

      <div
        ref={parentRef}
        className="bg-muted/40 border-border mx-auto max-w-4xl space-y-2 rounded-[calc(2px+8px)] rounded-b-none border border-b-0 p-2 pb-0 backdrop-blur-md backdrop-saturate-150"
      >
        <ChatAttachmentDisplay />

        <div className="bg-muted/60 border-border rounded-md rounded-b-none border border-b-0 p-2.5 pb-0">
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
  const router = useRouter();

  const input = useChatStore((state) => state.chatInput);
  const setChatInput = useChatStore((state) => state.setChatInput);

  return (
    <Textarea
      rows={3}
      name="user-input"
      id="textarea-chat-input"
      value={input}
      placeholder="Type your message here..."
      onChange={(event) => setChatInput(event.target.value)}
      className="max-h-[250px] w-full resize-none rounded-none border-0 !bg-transparent p-0 !ring-0"
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          void submitChatMessage({ router });
        }
      }}
    />
  );
}
