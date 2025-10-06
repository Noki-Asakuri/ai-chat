import * as React from "react";

import { Icons } from "../ui/icons";

import { MessageContent } from "./message-content";
import { MessageEditComposer } from "./message-edit-composer";
import { MessageFooter } from "./message-footer";
import { ThinkingToggle } from "./message-thinking";
import { UserAvatar } from "./user-avatar";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/shallow";

type MessageProps = {
  message: ChatMessage;
  index: number;
  isLast: boolean;
};

export function Message({ message, index, isLast }: MessageProps) {
  const { editMessage, lastUserMessageHeight, overlay, popupRetryMessageId, textareaHeight } =
    useChatStore(
      useShallow((state) => ({
        overlay: state.assistantMessages[message._id],
        editMessage: state.editMessage,
        popupRetryMessageId: state.popupRetryMessageId,
        textareaHeight: state.textareaHeight,
        lastUserMessageHeight: state.lastUserMessageHeight ?? 114,
      })),
    );

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const userMessageHeight =
    lastUserMessageHeight > window.innerHeight ? 114 : lastUserMessageHeight;

  const minHeight =
    isLast && message.role === "assistant"
      ? // 100vh - (padding top + padding bottom + textarea height + last known user message height)
        `calc(100vh - (40px + ${Math.max(textareaHeight, 165 + 50)}px + 16px + ${userMessageHeight}px))`
      : "auto";

  // Keep assistant min-height in sync with live changes to the most recent user message
  React.useEffect(() => {
    if (!(message.role === "user" && isLast)) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        useChatStore.getState().setMessageHeight(h);
      }
    });

    // init and observe
    useChatStore.getState().setMessageHeight(el.clientHeight);
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [isLast, message.role]);

  const renderMessage =
    message.role === "assistant" && message.status === "streaming" && overlay ? overlay : message;

  const isLoading =
    (message.status === "streaming" || message.status === "pending") &&
    !renderMessage.content &&
    !renderMessage.reasoning;

  return (
    <div
      ref={containerRef}
      style={{ minHeight }}
      data-slot="message-wrapper"
      data-height={lastUserMessageHeight}
    >
      <div
        data-slot="message"
        className="group flex gap-2"
        key={message.messageId}
        data-index={index}
        data-islast={isLast}
        data-role={message.role}
        data-id={message.messageId}
        data-status={message.status}
        data-model={message.model}
        data-streaming={message.status === "streaming" || message.status === "pending"}
        data-open={popupRetryMessageId === message._id || editMessage?._id === message._id}
      >
        {isLoading ? (
          <MessageLoading model={message.model} />
        ) : (
          <MessageInner message={message} index={index} isLast={isLast} />
        )}

        {message.role === "user" && <UserAvatar />}
      </div>
    </div>
  );
}

function MessageLoading({ model }: { model: ChatMessage["model"] }) {
  const modelData = getModelData(model || "google/gemini-2.5-flash");

  return (
    <div className="flex h-11 w-full shrink-0 items-center gap-2 rounded-md border bg-background/80 px-4 py-2 backdrop-blur-md backdrop-saturate-150">
      <div className="flex gap-2">
        <div className="flex items-center justify-center gap-2">
          <Icons.provider provider={modelData?.provider} className="size-5 rounded-md" />
          <span>{modelData?.display.name}: </span>
        </div>

        <span>Waiting for server response...</span>
      </div>
    </div>
  );
}

function MessageInner({ message, index, isLast }: MessageProps) {
  const isMobile = useIsMobile();

  const editMessage = useChatStore((state) => state.editMessage);
  const overlay = useChatStore((state) => state.assistantMessages[message._id]);

  const renderMessage =
    message.role === "assistant" && message.status === "streaming" && overlay ? overlay : message;

  return (
    <div
      className={cn("relative flex grow-0 flex-col gap-2", "[&:has(.codeblock)]:w-full", {
        "w-full": message.role === "assistant" || editMessage?._id === message._id || isMobile,
        "mx-0 max-w-[calc(100%-44px-8px)] md:ml-auto":
          message.role === "user" && editMessage?._id !== message._id && !isMobile,
      })}
    >
      <ThinkingToggle
        status={message.status}
        messageId={message.messageId}
        message={renderMessage}
      />

      {message.role === "user" && editMessage?._id === message._id ? (
        <MessageEditComposer message={message} index={index} />
      ) : (
        <MessageContent content={renderMessage.content} message={message} />
      )}

      {!(message.role === "user" && editMessage?._id === message._id) && (
        <MessageFooter
          message={message}
          index={index}
          renderMessage={renderMessage}
          isLast={isLast}
        />
      )}
    </div>
  );
}
