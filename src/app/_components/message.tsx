import { useEffect, useRef } from "react";
import { Loader2Icon, RefreshCcwIcon } from "lucide-react";

import { api } from "@/convex/_generated/api";

import { MemoizedMarkdown } from "./markdown";

import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

import { getModelData } from "@/lib/chat/model-data";
import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { getConvexClient } from "@/lib/convex/client";

import type { ChatMessage, ChatRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat/store";

const convexClient = getConvexClient();

export function ChatMessages({ className }: { className?: string }) {
  const messages = useChatStore((state) => state.messages);
  const assistant = useChatStore((state) => state.assistantMessage);

  const parentRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef<boolean>(false);

  useEffect(() => {
    console.debug("[Scroll] Scrolling to bottom");
    if (shouldAutoScroll.current) {
      parentRef.current?.scrollTo({ top: parentRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [assistant]);

  function handleOnScroll(event: React.UIEvent<HTMLDivElement>) {
    event.preventDefault();

    // Auto scroll if the user scroll back to bottom
    // Else we disable auto scroll
    if (event.currentTarget.scrollHeight - event.currentTarget.scrollTop === event.currentTarget.clientHeight) {
      shouldAutoScroll.current = true;
    } else {
      shouldAutoScroll.current = false;
    }
  }

  return (
    <ScrollArea
      ref={parentRef}
      onScroll={handleOnScroll}
      id="messages-scrollarea"
      className={cn("flex h-svh flex-col gap-2", className)}
      viewportClassName="*:pb-34"
    >
      {messages.map((message, index) => (
        <Message key={message.messageId} message={message} index={index} isLast={index === messages.length - 1} />
      ))}
    </ScrollArea>
  );
}

async function tryMessage(index: number) {
  const state = useChatStore.getState();
  const threadId = state.threadId;

  const userMessageIndex = index % 2 === 0 ? index : index - 1;
  const allMessages = state.messages.slice(0, userMessageIndex + 1).map((message) => ({
    id: message.messageId,
    role: message.role,
    content: message.content,
  }));

  const assistantMessage = {
    messageId: crypto.randomUUID(),
    content: "",
    role: "assistant" as const,
    status: "pending" as const,
    model: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const deleteMessageIds = state.messages
    .slice(userMessageIndex + 1, state.messages.length)
    .map((message) => message._id);

  const assistantMessageId = await convexClient.mutation(api.messages.retryChatMessage, {
    threadId,
    messageIds: deleteMessageIds,
    message: assistantMessage,
  });

  const body: ChatRequest = {
    messages: allMessages,
    threadId,
    assistantMessageId,
  };

  await sendChatRequest(body);
}

export function Message({ message, index, isLast }: { message: ChatMessage; index: number; isLast: boolean }) {
  const assistantMessage = useChatStore((state) => state.assistantMessage);
  const content =
    message.role === "assistant" && assistantMessage?.id === message._id ? assistantMessage.content : message.content;

  return (
    <div
      className="group mx-auto flex max-w-4xl items-start gap-2"
      id={message.messageId}
      data-role={message.role}
      data-status={message.status}
      data-index={index}
      data-streaming={message.status === "streaming"}
      data-is-last={isLast}
    >
      {message.status === "pending" && (
        <div className="flex h-11 shrink-0 items-center">
          <Loader2Icon className="size-6 animate-spin" />
        </div>
      )}

      <div
        className={cn("flex w-full flex-col", {
          hidden: message.status === "pending",
          "mx-0 ml-auto w-max gap-1": message.role === "user",
        })}
      >
        <div
          className={cn(
            "prose dark:prose-invert max-w-none space-y-2",
            "prose-hr:my-4 prose-hr:border-border prose-pre:p-0 prose-pre:my-0",
            {
              "bg-muted/70 rounded-md px-4 py-2": message.role === "user",
              "bg-destructive/60 border-destructive rounded-md px-4 py-2 backdrop-blur-md": message.status === "error",
            },
          )}
        >
          <MemoizedMarkdown id={message.messageId} content={content} />
        </div>

        <div
          className={cn("pointer-events-none flex gap-2 opacity-0 transition-opacity", {
            "pointer-events-auto group-hover:opacity-100": message.status === "error" || message.status === "complete",
            hidden: message.status === "pending" || message.status === "streaming",
          })}
        >
          <div>
            <Button variant="ghost" className="size-8 cursor-pointer p-2" onMouseDown={() => tryMessage(index)}>
              <RefreshCcwIcon className="size-4" />
            </Button>
          </div>

          {message.metadata && (
            <div className="text-muted-foreground/80 flex items-center gap-1.5 text-sm">
              <span>{(message.metadata.duration / 1000).toFixed(2)}s</span>
              <span>-</span>
              <span>{message.metadata.totalTokens} Tokens</span>
              <span>-</span>
              <span>Generated By {getModelData(message.model).displayName}</span>
            </div>
          )}
        </div>
      </div>

      {message.role === "user" && (
        <div className="bg-muted flex size-11 items-center justify-center rounded-md">You</div>
      )}
    </div>
  );
}
