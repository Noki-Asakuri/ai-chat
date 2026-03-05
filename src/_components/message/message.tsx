import type { Id } from "@/convex/_generated/dataModel";

import { BanIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useShallow } from "zustand/shallow";

import { ChatEditTextarea } from "../chat-textarea/chat-edit-textarea";
import { MessageContent } from "./message-content";
import { MessageFooter } from "./message-footer";
import { MessagePending } from "./message-pending";

import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";

type MessageProps = {
  messageId: Id<"messages">;
  index: number;
  total: number;
  readOnly?: boolean;
  showUserAvatar?: boolean;
};

const FALLBACK_INTRINSIC_MESSAGE_HEIGHT_PX = 220;
const MAX_CACHED_MESSAGE_HEIGHTS = 600;
const messageHeightCachePx = new Map<Id<"messages">, number>();

function trimCachedMessageHeights(): void {
  while (messageHeightCachePx.size > MAX_CACHED_MESSAGE_HEIGHTS) {
    const oldestCacheEntry = messageHeightCachePx.keys().next();
    if (oldestCacheEntry.done) return;

    messageHeightCachePx.delete(oldestCacheEntry.value);
  }
}

function getIntrinsicMessageHeightPx(messageId: Id<"messages">): number {
  const cachedHeight = messageHeightCachePx.get(messageId);

  if (!cachedHeight || cachedHeight <= 0) {
    return FALLBACK_INTRINSIC_MESSAGE_HEIGHT_PX;
  }

  return cachedHeight;
}

function cacheMessageHeight(messageId: Id<"messages">, element: HTMLDivElement): void {
  const nextHeight = Math.round(element.getBoundingClientRect().height);
  if (nextHeight <= 0) return;

  if (messageHeightCachePx.has(messageId)) {
    messageHeightCachePx.delete(messageId);
  }

  messageHeightCachePx.set(messageId, nextHeight);
  trimCachedMessageHeights();
}

export function Message({
  messageId,
  index,
  total,
  readOnly = false,
  showUserAvatar = true,
}: MessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const message = useMessageStore(useShallow((state) => state.messagesById[messageId]!));
  const isLast = isLastMessage(message.role, index, total);
  const canDeferOffscreenRendering =
    !isLast && (message.status === "complete" || message.status === "error");
  const intrinsicMessageHeightPx = getIntrinsicMessageHeightPx(messageId);

  const { lastUserMessageHeight, textareaHeight } = useChatStore(
    useShallow((state) => ({
      lastUserMessageHeight: state.lastUserMessageHeight ?? 114,
      textareaHeight: state.textareaHeight,
    })),
  );

  const userMessageHeight =
    lastUserMessageHeight > window.innerHeight ? 114 : lastUserMessageHeight;

  const minHeight =
    isLast && message.role === "assistant"
      ? // 100vh - 48px (padding top) - textarea height - user message height - (16px) separator between messages
        `${window.innerHeight - 48 - textareaHeight - userMessageHeight - 16}px`
      : "auto";

  const containerStyle: CSSProperties = canDeferOffscreenRendering
    ? {
        minHeight,
        contentVisibility: "auto",
        containIntrinsicSize: `auto ${intrinsicMessageHeightPx}px`,
      }
    : { minHeight };

  useEffect(() => {
    if (!canDeferOffscreenRendering || !containerRef.current) return;

    const element = containerRef.current;
    cacheMessageHeight(messageId, element);

    const resizeObserver = new ResizeObserver(() => {
      cacheMessageHeight(messageId, element);
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canDeferOffscreenRendering, messageId]);

  // Keep assistant message min-height in sync with live changes to the most recent user message
  useEffect(() => {
    // Only the last user message should drive `lastUserMessageHeight`.
    if (message.role !== "user" || !isLast || !containerRef.current) return;

    const element = containerRef.current;
    let lastReportedHeight = -1;

    function reportHeight(nextHeight: number): void {
      if (nextHeight === lastReportedHeight) return;

      lastReportedHeight = nextHeight;
      chatStoreActions.setMessageHeight(nextHeight);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        reportHeight(Math.round(entry.contentRect.height));
      }
    });

    // init and observe
    reportHeight(Math.round(element.getBoundingClientRect().height));
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [message.role, isLast]);

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      data-slot="message"
      className="group flex flex-col gap-2"
      key={message._id}
      data-index={index}
      data-islast={isLast}
      data-role={message.role}
      data-model={message.metadata?.model.request}
      data-id={message._id}
      data-height={lastUserMessageHeight}
      data-effort={message.metadata?.modelParams.effort}
      data-web-search={message.metadata?.modelParams.webSearch ?? false}
    >
      <ConditionallyRenderedMessage
        message={message}
        isLast={isLast}
        readOnly={readOnly}
        showUserAvatar={showUserAvatar}
      />
    </div>
  );
}

function isLastMessage(role: ChatMessage["role"], index: number, total: number): boolean {
  if (index === total - 1) return true;
  if (role === "user" && index === total - 2) return true;
  return false;
}

export function ConditionallyRenderedMessage({ message, ...props }: MessageInnerProps) {
  if (message.status === "pending" && !message.parts.length) {
    return <MessagePending metadata={message.metadata} />;
  }

  return <MessageInner message={message} {...props} />;
}

type MessageInnerProps = {
  message: ChatMessage;
  isLast: boolean;
  readOnly?: boolean;
  showUserAvatar?: boolean;
};

function MessageInner({
  message,
  isLast,
  readOnly = false,
  showUserAvatar = true,
}: MessageInnerProps) {
  const editMessageId = useChatStore((state) => state.editMessage?._id);
  const isEditingMessage = message._id === editMessageId;

  if (isEditingMessage && !readOnly) return <ChatEditTextarea />;

  const isMessageCancelled =
    message.role === "assistant" && message.metadata?.finishReason === "aborted";

  return (
    <>
      <MessageContent message={message} showUserAvatar={showUserAvatar} />
      {isMessageCancelled && <CancelledMessage />}
      <MessageFooter isLast={isLast} message={message} readOnly={readOnly} />
    </>
  );
}

function CancelledMessage() {
  return (
    <div className="mt-2 flex w-full justify-center">
      <div className="inline-flex items-center gap-2 rounded-md border border-destructive/50 bg-background/80 px-3 py-1 text-sm font-medium text-destructive backdrop-blur-md backdrop-saturate-150">
        <BanIcon className="size-4" />
        <span>Cancelled</span>
      </div>
    </div>
  );
}
