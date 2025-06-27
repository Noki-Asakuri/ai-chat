import { useCallback, useEffect, useRef } from "react";

import { ScrollArea } from "../ui/scroll-area";

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
      const entry = entries[0];
      if (!entry) return;

      const parentElement = entry.target.parentElement!.parentElement!;

      if (
        parentElement.scrollHeight === parentElement.clientHeight &&
        parentElement.scrollTop === 0
      ) {
        setScrollPosition(null);
      } else if (parentElement.scrollTop === 0) {
        setScrollPosition("top");
      } else if (
        parentElement.scrollTop + parentElement.clientHeight ===
        parentElement.scrollHeight
      ) {
        setScrollPosition("bottom");
      } else {
        setScrollPosition("middle");
      }

      if (parentElement.scrollHeight === parentElement.clientHeight) {
        prevScrollTopRef.current = -1;
        autoScroll.current = true;
      }

      if (autoScroll.current) {
        parentElement.scrollTo({ top: parentElement.scrollHeight, behavior: "smooth" });
      }
    },
    [setScrollPosition],
  );

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

  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(scrollContainerRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, [onResize]);

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
    } else if (element.scrollTop + element.clientHeight === element.scrollHeight) {
      setScrollPosition("bottom");
    } else {
      setScrollPosition("middle");
    }
  }

  return (
    <ScrollArea
      ref={scrollContainerRef}
      onScroll={handleOnScroll}
      className="h-full max-w-full py-10"
      viewport={{ id: "messages-scrollarea" }}
      style={{ paddingBottom: `${textareaHeight + 20}px`, fontVariantLigatures: "none" }}
    >
      <div className="content">
        {messages.map((message, index) => (
          <Message
            key={message.messageId}
            message={message}
            index={index}
            isLast={index === messages.length - 1}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
