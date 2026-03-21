import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { Message } from "./message";

import {
  consumeStickyResizeAutoScrollSuppression,
  scrollToBottomIfStickyRaf,
  updateStickyToBottomFromScroll,
} from "@/lib/chat/scroll-stickiness";
import { useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";

export function MessageHistory({
  readOnly = false,
  showUserAvatar = true,
  bottomPaddingPx,
  animateOnMount = false,
  animationKey,
}: {
  readOnly?: boolean;
  showUserAvatar?: boolean;
  bottomPaddingPx?: number;
  animateOnMount?: boolean;
  animationKey?: string;
}) {
  const textareaHeight = useChatStore((state) => state.textareaHeight);
  const resolvedBottomPadding = bottomPaddingPx ?? textareaHeight;
  const prefersReducedMotion = useReducedMotion() ?? false;

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
        if (consumeStickyResizeAutoScrollSuppression()) return;
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
        style={{ paddingBottom: `${resolvedBottomPadding}px` }}
      >
        <AnimatedMessages
          animateOnMount={animateOnMount}
          animationKey={animationKey}
          prefersReducedMotion={prefersReducedMotion}
          readOnly={readOnly}
          showUserAvatar={showUserAvatar}
        />
      </div>
    </div>
  );
}

function AnimatedMessages({
  animateOnMount,
  animationKey,
  prefersReducedMotion,
  readOnly = false,
  showUserAvatar = true,
}: {
  animateOnMount: boolean;
  animationKey?: string;
  prefersReducedMotion: boolean;
  readOnly?: boolean;
  showUserAvatar?: boolean;
}) {
  const content = <Messages readOnly={readOnly} showUserAvatar={showUserAvatar} />;

  if (!animateOnMount || prefersReducedMotion) {
    return content;
  }

  return (
    <motion.div
      key={animationKey ?? "message-history"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {content}
    </motion.div>
  );
}

function Messages({
  readOnly = false,
  showUserAvatar = true,
}: {
  readOnly?: boolean;
  showUserAvatar?: boolean;
}) {
  const messages = useMessageStore((state) => state.messageIds);

  return messages.map((messageId, index) => (
    <Message
      key={messageId}
      messageId={messageId}
      index={index}
      total={messages.length}
      readOnly={readOnly}
      showUserAvatar={showUserAvatar}
    />
  ));
}
