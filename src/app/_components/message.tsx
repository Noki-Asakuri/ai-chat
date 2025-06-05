import { useCopyToClipboard } from "@uidotdev/usehooks";
import {
  CopyCheckIcon,
  CopyIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  SaveIcon,
  SparkleIcon,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexReactClient } from "@/lib/convex/client";

import { MemoizedMarkdown } from "./markdown";

import { Accordion, AccordionContent, AccordionItem } from "./ui/accordion";
import { ButtonWithTip } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";

import { getModelData } from "@/lib/chat/models";
import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage, ChatRequest } from "@/lib/types";
import { cn, format } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ChatMessages({ className }: { className?: string }) {
  const messages = useChatStore((state) => state.messages);
  const setScrollPosition = useChatStore((state) => state.setScrollPosition);
  const abortController = useRef<AbortController>(new AbortController());

  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const parentRef = useRef<HTMLDivElement>(null);
  const prevScrollTopRef = useRef<number>(-1);
  const autoScroll = useRef<boolean>(true);

  function onResize(entries: ResizeObserverEntry[]) {
    const entry = entries[0];
    if (!entry) return;

    const parentElement = entry.target.parentElement!;

    console.log(parentElement.scrollHeight, parentElement.clientHeight, parentElement.scrollTop);

    if (parentElement.scrollHeight === parentElement.clientHeight && parentElement.scrollTop === 0) {
      setScrollPosition(null);
    } else if (parentElement.scrollTop === 0) {
      setScrollPosition("top");
    } else if (parentElement.scrollTop + parentElement.clientHeight === parentElement.scrollHeight) {
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
    if (!parentRef.current) return;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(parentRef.current.querySelector("div")!.firstElementChild!);

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
      ref={parentRef}
      onScroll={handleOnScroll}
      className={cn("flex h-full flex-col gap-2", className)}
      viewportClassName="*:h-full"
      viewportId="messages-scrollarea"
      viewportstyle={{ paddingBottom: `${textareaHeight}px` }}
    >
      {messages.map((message, index) => (
        <Message key={message.messageId} message={message} index={index} isLast={index === messages.length - 1} />
      ))}
    </ScrollArea>
  );
}

async function retryMessage(index: number, editedUserMessage?: { _id: Id<"messages">; content: string }) {
  const state = useChatStore.getState();
  const threadId = state.threadId!;

  const userMessageIndex = index % 2 === 0 ? index : index - 1;
  const allMessages = state.messages.slice(0, userMessageIndex + 1).map((message) => ({
    id: message.messageId,
    role: message.role,
    content: message.content,
  }));

  const assistantMessage = {
    messageId: uuidv4(),
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
    userMessage: editedUserMessage
      ? {
          role: "user" as const,
          messageId: editedUserMessage._id,
          content: editedUserMessage.content,
        }
      : undefined,
  });

  if (editedUserMessage) {
    allMessages.at(-1)!.content = editedUserMessage.content;
  }

  const body: ChatRequest = {
    messages: allMessages,
    threadId,
    assistantMessageId,
    config: state.chatConfig,
  };

  await sendChatRequest("/api/ai/chat", { method: "POST", body: JSON.stringify(body) }, assistantMessageId);
}

export function Message({ message, index, isLast }: { message: ChatMessage; index: number; isLast: boolean }) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [, copyToClipboard] = useCopyToClipboard();

  const copyRef = useRef<NodeJS.Timeout | null>(null);

  const [editedUserMessage, setEditedUserMessage] = useState<string>(message.content);

  const status = useChatStore((state) => state.status);
  const assistantMessage = useChatStore((state) => state.assistantMessage);

  const editMessageId = useChatStore((state) => state.editMessageId);
  const setEditMessageId = useChatStore((state) => state.setEditMessageId);

  const renderMesssage =
    message.role === "assistant" && assistantMessage?.id === message._id && message.status === "streaming"
      ? assistantMessage
      : message;

  async function copeMessageContent(content: string) {
    if (copyRef.current) clearTimeout(copyRef.current);

    await copyToClipboard(content.trim());
    setCopySuccess(true);

    copyRef.current = setTimeout(() => setCopySuccess(false), 1000);
  }

  function handleEditMessage() {
    if (message.role === "assistant") return;

    setEditMessageId(editMessageId === message._id ? null : message._id);
    setEditedUserMessage(message.content);
  }

  return (
    <div
      className="group mx-auto flex max-w-[calc(896px+32px)] items-start gap-2 px-4 [&:not(:first-child)]:mt-12 [&[data-streaming='false']:last-child]:mb-12"
      id={message.messageId}
      data-role={message.role}
      data-status={message.status}
      data-index={index}
      data-streaming={message.status === "streaming" || message.status === "pending"}
      data-is-last={isLast}
    >
      {message.role === "assistant" &&
        message.status !== "error" &&
        (message.status === "pending" || (!renderMesssage.content && !renderMesssage.reasoning)) && (
          <div className="flex h-11 shrink-0 items-center">
            <Loader2Icon className="size-6 animate-spin" />
          </div>
        )}

      <div
        className={cn("relative flex w-full flex-col", {
          hidden: message.status === "pending",
          "mx-0 ml-auto w-max gap-1": message.role === "user",
        })}
      >
        <ThinkingToggle
          messageId={message.messageId}
          finished={renderMesssage.content.length > 0}
          reasoning={renderMesssage.reasoning}
          status={message.status}
          tokens={renderMesssage.metadata?.thinkingTokens}
        />

        {message.role === "user" && editMessageId === message._id ? (
          <Textarea
            rows={3}
            name="user-input"
            defaultValue={editedUserMessage}
            onChange={(event) => setEditedUserMessage(event.target.value)}
            className="min-h-11 w-full min-w-[80ch] resize-none px-4 py-2 font-sans outline-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void retryMessage(index, { _id: message._id, content: editedUserMessage });
                setEditMessageId(null);
              }
            }}
          />
        ) : (
          <div
            className={cn("max-w-full space-y-6", "", {
              "bg-sidebar/50 rounded-md border px-4 py-2": message.role === "user",
              "bg-destructive/20 border-destructive/50 rounded-md border px-4 py-2 backdrop-blur-md":
                message.status === "error",
            })}
          >
            {message.status === "error" ? (
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              <p>{message.error || "An error have occurred. Please try again."}</p>
            ) : (
              <MemoizedMarkdown id={message.messageId} content={renderMesssage.content} />
            )}

            {message.sources && message.sources.filter(({ title }) => !!title).length > 0 && (
              <div className="not-prose flex w-full flex-wrap items-center gap-2 gap-y-1">
                <span>Sources: </span>

                {message.sources
                  .filter(({ title }) => !!title)
                  .map(({ id, title, url }) => (
                    <a
                      key={id}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="capitalize underline underline-offset-2"
                      href={url}
                    >
                      {title?.replace(".com", "")}
                    </a>
                  ))}
              </div>
            )}
          </div>
        )}

        <div
          className={cn("pointer-events-none absolute -bottom-10 flex gap-2 opacity-0 transition-opacity select-none", {
            "pointer-events-auto group-hover:opacity-100": message.status === "error" || message.status === "complete",
            hidden: message.status === "pending" || message.status === "streaming",
            "right-0": message.role === "user",
            "opacity-100": editMessageId === message._id,
          })}
        >
          <div className="flex items-center gap-2">
            <ButtonWithTip
              variant="ghost"
              className="size-8 cursor-pointer p-2"
              onMouseDown={() => retryMessage(index)}
              title="Retry Message"
              disabled={status === "pending"}
            >
              <RefreshCcwIcon className="size-5" />
            </ButtonWithTip>

            {message.role === "user" && (
              <ButtonWithTip
                variant="ghost"
                className="size-8 cursor-pointer p-2"
                onMouseDown={() => handleEditMessage()}
                title="Edit Message"
                disabled={status === "pending"}
              >
                {editMessageId === message._id ? <SaveIcon className="size-5" /> : <PencilIcon className="size-5" />}
              </ButtonWithTip>
            )}

            <ButtonWithTip
              variant="ghost"
              className="size-8 cursor-pointer p-2"
              onMouseDown={() => copeMessageContent(message.content)}
              title="Copy Message"
              disabled={copySuccess}
            >
              {copySuccess ? <CopyCheckIcon className="size-5" /> : <CopyIcon className="size-5" />}
            </ButtonWithTip>
          </div>

          {renderMesssage.metadata && (
            <div className="text-muted-foreground/90 flex items-center gap-1.5 text-sm select-none">
              <span>{format.time(renderMesssage.metadata.duration / 1000)}</span>
              <span>-</span>
              <span>Generated By {getModelData(message.model).displayName}</span>
              <span>-</span>
              <span>{format.number(renderMesssage.metadata.totalTokens)} Tokens</span>
              {renderMesssage.metadata.thinkingTokens > 0 && (
                <>
                  <span>-</span>
                  <span>
                    {format.number(renderMesssage.metadata.thinkingTokens)} {renderMesssage.reasoning ? "" : "Hidden"}{" "}
                    Thinking Tokens
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {message.role === "user" && (
        <div className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-md">You</div>
      )}
    </div>
  );
}

function ThinkingToggle({
  messageId,
  reasoning,
  finished,
  status,
  tokens,
}: {
  messageId: string;
  reasoning?: string;
  finished: boolean;
  status: ChatMessage["status"];
  tokens?: number;
}) {
  if (!reasoning || status === "error") return null;
  const defaultValue = status === "streaming" ? `${messageId}-thinking` : undefined;

  return (
    <Accordion type="single" collapsible defaultValue={defaultValue} className="my-4 w-full space-y-2">
      <AccordionItem value={messageId + "-thinking"} className="bg-secondary rounded-md border-none">
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger
            className={cn(
              "flex w-max flex-1 cursor-pointer items-center justify-between px-4 py-4 font-medium transition-all outline-none",
              { "[&[data-state=open]>svg]:rotate-45": status !== "streaming" },
            )}
          >
            <div className="group flex items-center gap-2">
              <SparkleIcon className="size-5" />
              <p>Thinking {tokens && <span className="text-sm">- {format.number(tokens)} Thinking Tokens</span>}</p>
            </div>

            {status === "streaming" && !finished ? (
              <Loader2Icon className="text-muted-foreground size-5 shrink-0 animate-spin" />
            ) : (
              <PlusIcon className="text-muted-foreground size-5 shrink-0 transition-transform duration-200" />
            )}
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>

        <AccordionContent>
          <hr />
          <div className="prose dark:prose-invert max-w-none space-y-2 px-4 pt-4">
            <MemoizedMarkdown id={messageId + "-thinking"} content={reasoning} />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
