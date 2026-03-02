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
  const scrollRafRef = useRef<number | null>(null);
  const stickySyncRafRef = useRef<number | null>(null);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const content = contentRef.current;
    if (!scrollArea || !content) return;

    const scrollElement: HTMLElement = scrollArea;

    // Initialize sticky state based on the current scroll position (after initial render).
    updateStickyToBottomFromScroll(scrollElement);

    function syncStickyFromScroll(): void {
      updateStickyToBottomFromScroll(scrollElement);
    }

    function handleScroll(): void {
      if (scrollRafRef.current !== null) return;

      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        syncStickyFromScroll();
      });
    }

    const passiveScrollOptions: AddEventListenerOptions = { passive: true };
    scrollElement.addEventListener("scroll", handleScroll, passiveScrollOptions);

    const resizeObserver = new ResizeObserver(() => {
      if (stickySyncRafRef.current !== null) return;

      stickySyncRafRef.current = requestAnimationFrame(() => {
        stickySyncRafRef.current = null;
        scrollToBottomIfStickyRaf(scrollElement, "auto");
      });
    });

    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();

      scrollElement.removeEventListener("scroll", handleScroll, passiveScrollOptions);

      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }

      if (stickySyncRafRef.current !== null) {
        cancelAnimationFrame(stickySyncRafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={scrollAreaRef}
      id="messages-scrollarea"
      className="custom-scroll absolute inset-0 overflow-y-scroll"
      style={{ scrollbarGutter: "stable both-edges" }}
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
