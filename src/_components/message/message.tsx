import type { Id } from "@/convex/_generated/dataModel";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";

import { Icons } from "../ui/icons";

import { ChatEditTextarea } from "../chat-textarea/chat-edit-textarea";
import { MessageContent } from "./message-content";
import { MessageFooter } from "./message-footer";

import { getModelData } from "@/lib/chat/models";
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
      textareaHeight: state.textareaHeight,
      lastUserMessageHeight: state.lastUserMessageHeight ?? 114,
    })),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  const userMessageHeight =
    lastUserMessageHeight > window.innerHeight ? 114 : lastUserMessageHeight;

  const minHeight =
    isLast && message.role === "assistant"
      ? // 100vh - (padding top + padding bottom + textarea height + last known user message height)
        `calc(100vh - (40px + ${Math.max(textareaHeight, 165 + 50)}px + 16px + ${userMessageHeight}px))`
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
      data-model={message.metadata?.model}
      data-id={message._id}
      data-height={lastUserMessageHeight}
      data-effort={message.metadata?.modelParams.effort}
      data-web-search={message.metadata?.modelParams.webSearch ?? false}
    >
      {message.status === "pending" || !message.parts.length ? (
        <MessageLoading metadata={message.metadata} />
      ) : (
        <MessageInner message={message} index={index} isLast={isLast} />
      )}
    </div>
  );
}

type MessageLoadingProps = {
  metadata: ChatMessage["metadata"];
};

function MessageLoading({ metadata }: MessageLoadingProps) {
  const modelData = getModelData(metadata?.model.request!);
  const effort = metadata?.modelParams?.effort;

  const showEffort =
    modelData.capabilities.reasoning === true && effort !== undefined && effort !== "medium";

  return (
    <div className="flex h-11 w-full shrink-0 items-center gap-2 rounded-md border bg-background/80 px-4 py-2 backdrop-blur-md backdrop-saturate-150">
      <div className="flex gap-2">
        <div className="flex items-center justify-center gap-2">
          <Icons.provider provider={modelData?.provider} className="size-5 rounded-md" />

          <span>
            {modelData?.display.name}{" "}
            {showEffort && (
              <span className="text-sm capitalize">({metadata?.modelParams?.effort})</span>
            )}
            :
          </span>
        </div>

        <span>Waiting for server response...</span>
      </div>
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
