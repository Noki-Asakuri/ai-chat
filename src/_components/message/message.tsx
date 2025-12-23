import type { Id } from "@/convex/_generated/dataModel";

import { useEffect, useRef } from "react";
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
};

export function Message({ messageId, index, total }: MessageProps) {
  const message = useMessageStore(useShallow((state) => state.messagesById[messageId]!));
  const isLast = message.role === "user" ? index === total - 2 : index === total - 1;

  const { lastUserMessageHeight, textareaHeight } = useChatStore(
    useShallow((state) => ({
      lastUserMessageHeight: state.lastUserMessageHeight ?? 114,
      textareaHeight: state.textareaHeight,
    })),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  const userMessageHeight =
    lastUserMessageHeight > window.innerHeight ? 114 : lastUserMessageHeight;

  const minHeight =
    isLast && message.role === "assistant"
      ? // 100vh - 48px (padding top) - textarea height - user message height - (16px) separator between messages
        `${window.innerHeight - 48 - textareaHeight - userMessageHeight - 16}px`
      : "auto";

  // Keep assistant min-height in sync with live changes to the most recent user message
  useEffect(() => {
    if (!(message.role === "user" && isLast)) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        chatStoreActions.setMessageHeight(h);
      }
    });

    // init and observe
    chatStoreActions.setMessageHeight(el.clientHeight);
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [isLast, message.role]);

  return (
    <div
      ref={containerRef}
      style={{ minHeight }}
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
      {message.status === "pending" || !message.parts.length ? (
        <MessagePending metadata={message.metadata} />
      ) : (
        <MessageInner message={message} index={index} isLast={isLast} />
      )}
    </div>
  );
}

type MessageInnerProps = {
  message: ChatMessage;
  index: number;
  isLast: boolean;
};

function MessageInner({ message, index, isLast }: MessageInnerProps) {
  const editMessageId = useChatStore((state) => state.editMessage?._id);
  const isEditingMessage = message._id === editMessageId;

  if (isEditingMessage) return <ChatEditTextarea />;

  return (
    <>
      <MessageContent message={message} />
      <MessageFooter index={index} isLast={isLast} message={message} />
    </>
  );
}
