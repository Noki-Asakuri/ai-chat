import { useCallback, useEffect, useRef } from "react";

import { Message } from "./message";

import { useChatStore } from "@/lib/chat/store";

export function MessageHistory() {
  const messages = useChatStore((state) => state.messages);
  const setScrollPosition = useChatStore((state) => state.setScrollPosition);
  const abortController = useRef<AbortController>(new AbortController());

  const textareaHeight = useChatStore((state) => state.textareaHeight);

  // Outer scrollable container (with overflow-y-scroll)
  const outerScrollRef = useRef<HTMLDivElement>(null);
  // Inner content container (observed for size changes)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const prevScrollTopRef = useRef<number>(-1);
  const autoScroll = useRef<boolean>(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const scroller = outerScrollRef.current;
    if (!scroller) return;

    requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior });
    });
  }, []);

  const recomputeScrollPosition = useCallback(() => {
    const scroller = outerScrollRef.current;
    if (!scroller) return;

    if (scroller.scrollHeight === scroller.clientHeight && scroller.scrollTop === 0) {
      setScrollPosition(null);
    } else if (scroller.scrollTop === 0 && scroller.scrollHeight > scroller.clientHeight) {
      setScrollPosition("top");
    } else if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 50) {
      setScrollPosition("bottom");
    } else {
      setScrollPosition("middle");
    }
  }, [setScrollPosition]);

  // Observe inner content size changes to maintain stick-to-bottom when autoScroll is enabled.
  const onResize = useCallback(
    function () {
      const scroller = outerScrollRef.current;
      if (!scroller) return;

      recomputeScrollPosition();

      if (scroller.scrollHeight === scroller.clientHeight) {
        prevScrollTopRef.current = -1;
      }

      if (autoScroll.current) {
        // Smooth during normal updates
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
      }
    },
    [recomputeScrollPosition],
  );

  // Setup resize observer on inner content container
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(scrollContainerRef.current);

    // Initial snap to bottom on mount for better UX
    scrollToBottom("auto");

    return () => {
      resizeObserver.disconnect();
    };
  }, [onResize, scrollToBottom]);

  function handleForceScrollBottom() {
    autoScroll.current = true;
    scrollToBottom("smooth");
  }

  useEffect(() => {
    const controller = abortController.current;
    const signal = controller.signal;

    window.addEventListener("chat:force-scroll-bottom", handleForceScrollBottom, { signal });

    document.addEventListener(
      "copy",
      function (event) {
        const selectedText = window.getSelection()?.toString();
        if (!selectedText) return;

        if (navigator?.clipboard) {
          event.preventDefault();
          void navigator.clipboard.writeText(selectedText.trim());
        }
      },
      { signal },
    );

    return () => {
      if (!controller.signal.aborted) {
        controller.abort();
        abortController.current = new AbortController();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOnScroll(event: React.UIEvent<HTMLDivElement>) {
    // Allow native scrolling
    const scroller = event.currentTarget;

    const currentScrollTop = scroller.scrollTop;
    const prevScrollTop = prevScrollTopRef.current;

    // Disable auto-scroll when user scrolls up
    if (currentScrollTop < prevScrollTop) {
      autoScroll.current = false;
    } else if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 100) {
      // Re-enable when near bottom
      autoScroll.current = true;
    }

    prevScrollTopRef.current = currentScrollTop;

    // Update position state
    if (scroller.scrollHeight === scroller.clientHeight && scroller.scrollTop === 0) {
      setScrollPosition(null);
    } else if (scroller.scrollTop === 0 && scroller.scrollHeight > scroller.clientHeight) {
      setScrollPosition("top");
    } else if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 1) {
      setScrollPosition("bottom");
    } else {
      setScrollPosition("middle");
    }
  }

  return (
    <div
      id="messages-scrollarea"
      onScroll={handleOnScroll}
      className="custom-scroll absolute inset-0 overflow-y-scroll"
      style={{ scrollbarGutter: "stable both-edges" }}
      ref={outerScrollRef}
    >
      <div
        data-slot="message-history"
        className="mx-auto min-h-full max-w-[calc(896px+32px)] space-y-4 px-4 py-10"
        ref={scrollContainerRef}
        style={{ paddingBottom: `${textareaHeight + 20}px` }}
      >
        {messages.map((message, index) => (
          <Message
            key={message.messageId}
            message={message}
            index={index}
            isLast={
              message.role === "user"
                ? index === messages.length - 2
                : index === messages.length - 1
            }
          />
        ))}
      </div>
    </div>
  );
}
