import { Loader2Icon } from "lucide-react";
import React, { useEffect, useRef } from "react";

import { ScrollArea } from "./ui/scroll-area";

import { MessageContent } from "./chat/message-content";
import { MessageEdit } from "./chat/message-edit";
import { MessageFooter } from "./chat/message-footer";
import { ThinkingToggle } from "./chat/message-thinking";
import { UserAvatar } from "./chat/user-avatar";

import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatMessages() {
  const messages = useChatStore((state) => state.messages);
  const setScrollPosition = useChatStore((state) => state.setScrollPosition);
  const abortController = useRef<AbortController>(new AbortController());

  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollTopRef = useRef<number>(-1);
  const autoScroll = useRef<boolean>(true);

  function onResize(entries: ResizeObserverEntry[]) {
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
  }

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
    } else if (element.scrollTop + element.clientHeight === element.scrollHeight) {
      setScrollPosition("bottom");
    } else {
      setScrollPosition("middle");
    }
  }

  return (
    <ScrollArea
      onScroll={handleOnScroll}
      className="h-full w-full"
      viewportClassName="*:!contents"
      viewportId="messages-scrollarea"
    >
      <div
        className="max-w-full"
        id="messages-container"
        ref={scrollContainerRef}
        style={{ paddingBottom: `${textareaHeight}px`, fontVariantLigatures: "none" }}
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
    </ScrollArea>
  );
}

export function Message({
  message,
  index,
  isLast,
}: {
  message: ChatMessage;
  index: number;
  isLast: boolean;
}) {
  const assistantMessage = useChatStore((state) => state.assistantMessage);
  const editMessage = useChatStore((state) => state.editMessage);

  const renderMessage =
    message.role === "assistant" &&
    assistantMessage?.id === message._id &&
    message.status === "streaming"
      ? assistantMessage
      : message;

  return (
    <div
      className="group mx-auto flex max-w-[calc(896px+32px)] items-start gap-2 px-4 [&:not(:first-child)]:mt-14 [&[data-streaming='false']:last-child]:mb-14"
      id={message.messageId}
      data-role={message.role}
      data-status={message.status}
      data-index={index}
      data-streaming={message.status === "streaming" || message.status === "pending"}
      data-is-last={isLast}
    >
      {message.role === "assistant" &&
        message.status !== "error" &&
        (message.status === "pending" || (!renderMessage.content && !renderMessage.reasoning)) && (
          <div className="flex h-11 shrink-0 items-center">
            <Loader2Icon className="size-6 animate-spin" />
          </div>
        )}

      <div
        className={cn("relative flex w-full flex-col", {
          hidden: message.status === "pending",
          "mx-0 ml-auto w-auto gap-1": message.role === "user",
        })}
      >
        <ThinkingToggle
          messageId={message.messageId}
          finished={renderMessage.content.length > 0}
          reasoning={renderMessage.reasoning}
          status={message.status}
          tokens={renderMessage.metadata?.thinkingTokens}
        />

        {message.role === "user" && editMessage?._id === message._id ? (
          <MessageEdit content={message.content} index={index} id={message._id} />
        ) : (
          <MessageContent content={renderMessage.content} message={message} />
        )}

        <MessageFooter message={message} index={index} renderMessage={renderMessage} />
      </div>

      {message.role === "user" && <UserAvatar />}
    </div>
  );
}
