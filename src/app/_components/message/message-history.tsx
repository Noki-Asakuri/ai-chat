import { useCallback, useEffect, useRef } from "react";

import { Message } from "./message";

import { useChatStore } from "@/lib/chat/store";

export function MessageHistory() {
  const messages = useChatStore((state) => state.messages);
  const setScrollPosition = useChatStore((state) => state.setScrollPosition);
  const abortController = useRef<AbortController>(new AbortController());

  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollTopRef = useRef<number>(-1);
  const autoScroll = useRef<boolean>(true);

  const onResize = useCallback(
    (entries: ResizeObserverEntry[]) => {
      const element = entries[0]?.target.parentElement;
      if (!element) return;

      if (element.scrollHeight === element.clientHeight && element.scrollTop === 0) {
        setScrollPosition(null);
      } else if (element.scrollTop === 0) {
        setScrollPosition("top");
      } else if (element.scrollHeight - element.scrollTop - element.clientHeight < 1) {
        setScrollPosition("bottom");
      } else {
        setScrollPosition("middle");
      }

      if (element.scrollHeight === element.clientHeight) {
        prevScrollTopRef.current = -1;
      }

      if (autoScroll.current) {
        element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
      }
    },
    [setScrollPosition],
  );

  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(scrollContainerRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, [onResize]);

  useEffect(() => {
    const controller = abortController.current;
    const signal = controller.signal;

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
  }, []);

  function handleOnScroll(event: React.UIEvent<HTMLDivElement>) {
    event.preventDefault();

    const element = event.currentTarget;

    const currentScrollTop = element.scrollTop;
    const prevScrollTop = prevScrollTopRef.current;

    // User scrolling up
    if (currentScrollTop < prevScrollTop) {
      autoScroll.current = false;
    }

    // User scrolling near bottom
    else if (element.scrollHeight - element.scrollTop - element.clientHeight < 100) {
      autoScroll.current = true;
    }

    prevScrollTopRef.current = currentScrollTop;

    if (element.scrollHeight === element.clientHeight && element.scrollTop === 0) {
      setScrollPosition(null);
    } else if (element.scrollTop === 0 && element.scrollHeight > element.clientHeight) {
      setScrollPosition("top");
    } else if (element.scrollHeight - element.scrollTop - element.clientHeight < 1) {
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
            isLast={index === messages.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
