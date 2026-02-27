import { useEffect, useRef } from "react";

import { Message } from "./message";

import {
  scrollToBottomIfStickyRaf,
  updateStickyToBottomFromScroll,
} from "@/lib/chat/scroll-stickiness";
import { useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";

export function MessageHistory() {
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const content = contentRef.current;
    if (!scrollArea || !content) return;

    // Initialize sticky state based on the current scroll position (after initial render).
    updateStickyToBottomFromScroll(scrollArea);

    const resizeObserver = new ResizeObserver(() => {
      scrollToBottomIfStickyRaf(scrollArea, "auto");
    });

    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  function handleScroll(): void {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    updateStickyToBottomFromScroll(scrollArea);
  }

  return (
    <div
      ref={scrollAreaRef}
      id="messages-scrollarea"
      className="custom-scroll absolute inset-0 overflow-y-scroll"
      style={{ scrollbarGutter: "stable both-edges" }}
      onScroll={handleScroll}
    >
      <div
        ref={contentRef}
        data-slot="message-history"
        className="mx-auto min-h-full max-w-[calc(56rem+32px)] space-y-4 px-4 pt-12"
        style={{ paddingBottom: `${textareaHeight}px` }}
      >
        <Messages />
      </div>
    </div>
  );
}

function Messages() {
  const messages = useMessageStore((state) => state.messageIds);

  return messages.map((messageId, index) => (
    <Message key={messageId} messageId={messageId} index={index} total={messages.length} />
  ));
}
