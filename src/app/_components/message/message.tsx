import { useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";

import { Icons } from "../ui/icons";

import { MessageContent } from "./message-content";
import { MessageEditComposer } from "./message-edit-composer";
import { MessageFooter } from "./message-footer";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";

type MessageProps = {
  message: ChatMessage;
  index: number;
  isLast: boolean;
};

export function Message({ message, index, isLast }: MessageProps) {
  const { editMessage, lastUserMessageHeight, popupRetryMessageId, textareaHeight } = useChatStore(
    useShallow((state) => ({
      editMessage: state.editMessage,
      popupRetryMessageId: state.popupRetryMessageId,
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

  return (
    <div
      ref={containerRef}
      style={{ minHeight }}
      data-slot="message"
      className="group flex flex-col gap-2"
      key={message.messageId}
      data-index={index}
      data-islast={isLast}
      data-role={message.role}
      data-model={message.model}
      data-id={message.messageId}
      data-status={message.status}
      data-height={lastUserMessageHeight}
      data-effort={message.modelParams?.effort}
      data-web-search={message.modelParams?.webSearchEnabled ?? false}
      data-streaming={message.status === "streaming" || message.status === "pending"}
      data-open={popupRetryMessageId === message._id || editMessage?._id === message._id}
    >
      {message.status === "pending" ? (
        <MessageLoading model={message.model} params={message.modelParams} />
      ) : (
        <MessageInner message={message} index={index} isLast={isLast} />
      )}
    </div>
  );
}

type MessageLoadingProps = {
  model: ChatMessage["model"];
  params: ChatMessage["modelParams"];
};

function MessageLoading({ model, params }: MessageLoadingProps) {
  const modelData = getModelData(model || "google/gemini-2.5-flash");

  const showEffort =
    typeof modelData.capabilities.reasoning === "boolean" &&
    modelData.capabilities.reasoning === true &&
    params?.effort &&
    params.effort !== "medium";

  return (
    <div className="flex h-11 w-full shrink-0 items-center gap-2 rounded-md border bg-background/80 px-4 py-2 backdrop-blur-md backdrop-saturate-150">
      <div className="flex gap-2">
        <div className="flex items-center justify-center gap-2">
          <Icons.provider provider={modelData?.provider} className="size-5 rounded-md" />
          <span>
            {modelData?.display.name}{" "}
            {showEffort && <span className="text-sm capitalize">({params?.effort})</span>}:{" "}
          </span>
        </div>

        <span>Waiting for server response...</span>
      </div>
    </div>
  );
}

function MessageInner({ message, index, isLast }: MessageProps) {
  const editMessage = useChatStore((state) => state.editMessage);
  const overlay = useChatStore((state) => state.assistantMessages[message._id]);

  const renderMessage =
    message.role === "assistant" && message.status === "streaming" && overlay ? overlay : message;

  const shouldShowFooter = editMessage?._id !== message._id;
  const isUserMessageEdit = message.role === "user" && editMessage?._id === message._id;

  return (
    <>
      {isUserMessageEdit ? (
        <MessageEditComposer message={message} index={index} />
      ) : (
        <MessageContent parts={renderMessage.parts} message={message} />
      )}

      {shouldShowFooter && (
        <MessageFooter
          index={index}
          isLast={isLast}
          message={message}
          renderMessage={renderMessage}
        />
      )}
    </>
  );
}
