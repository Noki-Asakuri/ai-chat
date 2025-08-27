import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { MessageContent } from "./message-content";
import { MessageEditComposer } from "./message-edit-composer";
import { MessageFooter } from "./message-footer";
import { ThinkingToggle } from "./message-thinking";
import { UserAvatar } from "./user-avatar";

import { useChatStore } from "@/lib/chat/store";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageProps = {
  message: ChatMessage;
  index: number;
  isLast: boolean;
};

export function Message({ message, index, isLast }: MessageProps) {
  const assistantMessage = useChatStore((state) => state.assistantMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const popupRetryMessageId = useChatStore((state) => state.popupRetryMessageId);
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const lastUserMessageHeight = useChatStore((state) => state.lastUserMessageHeight) ?? 114;
  const setMessageHeight = useChatStore((state) => state.setMessageHeight);
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
        setMessageHeight(h);
      }
    });

    // init and observe
    setMessageHeight(el.clientHeight);
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [isLast, message.role, setMessageHeight]);

  const renderMessage =
    message.role === "assistant" &&
    assistantMessage?.id === message._id &&
    message.status === "streaming"
      ? assistantMessage
      : message;

  const isLoading =
    (message.status === "streaming" || message.status === "pending") &&
    !renderMessage.content &&
    !renderMessage.reasoning;

  return (
    <div
      data-slot="message-wrapper"
      data-height={lastUserMessageHeight}
      style={{ minHeight }}
      ref={containerRef}
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
          <MessageInner message={message} index={index} />
        )}

        {message.role === "user" && <UserAvatar />}
      </div>
    </div>
  );
}

function MessageLoading({ model }: { model: ChatMessage["model"] }) {
  return (
    <div className="bg-background/80 flex h-11 w-full shrink-0 items-center gap-2 rounded-md border px-4 py-2 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:border-0">
      <Loader2Icon className="size-6 animate-spin" />
      <span title={`Waiting for response from ${model}`}>Waiting for response...</span>
    </div>
  );
}

function MessageInner({ message, index }: Omit<MessageProps, "isLast">) {
  const isMobile = useIsMobile();

  const editMessage = useChatStore((state) => state.editMessage);
  const assistantMessage = useChatStore((state) => state.assistantMessage);

  const renderMessage =
    message.role === "assistant" &&
    assistantMessage?.id === message._id &&
    message.status === "streaming"
      ? assistantMessage
      : message;

  return (
    <div
      className={cn("relative flex grow-0 flex-col", "[&:has(.codeblock)]:w-full", {
        "w-full": message.role === "assistant" || editMessage?._id === message._id || isMobile,
        "mx-0 max-w-[calc(100%-44px-8px)] gap-1 md:ml-auto":
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
        <MessageFooter message={message} index={index} renderMessage={renderMessage} />
      )}
    </div>
  );
}
