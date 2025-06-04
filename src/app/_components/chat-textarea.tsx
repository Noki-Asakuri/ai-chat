"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexReactClient } from "@/lib/convex/client";

import { useRouter } from "next/navigation";

import { SendHorizontalIcon, SquareIcon, ToggleLeftIcon, ToggleRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

import { ScrollDownButton } from "./scroll-down-button";
import { Button, ButtonWithTip } from "./ui/button";
import { Textarea } from "./ui/textarea";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore, useChatStore } from "@/lib/chat/store";
import type { ChatRequest } from "@/lib/types";
import { toUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

async function submitChatMessage(event: { preventDefault: () => void }, router: ReturnType<typeof useRouter>) {
  event.preventDefault();

  const state = useChatStore.getState();
  const chatInput = state.chatInput.trim();

  if (!chatInput || state.status === "streaming") return;

  state.setChatInput("");
  let threadId: Id<"threads"> = state.threadId!;

  if (!state.threadId) {
    threadId = await convexClient.mutation(api.threads.createThread, { title: "New Chat" });

    router.push(`/chat/${toUUID(threadId)}`);
    state.setThreadId(threadId);
  }

  const userMessage = {
    messageId: uuidv4(),
    content: chatInput,
    role: "user" as const,
    status: "complete" as const,
    model: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const assistantMessage = {
    messageId: uuidv4(),
    content: "",
    role: "assistant" as const,
    status: "pending" as const,
    model: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const assistantMessageId = await convexClient.mutation(api.messages.addMessagesToThread, {
    threadId,
    messages: [userMessage, assistantMessage],
  });

  const allMessages = state.messages.map((message) => ({
    id: message.messageId,
    role: message.role as "assistant" | "user",
    content: message.content,
  }));

  allMessages.push({
    role: "user",
    content: chatInput,
    id: userMessage.messageId,
  });

  const body: ChatRequest = {
    threadId,
    assistantMessageId: assistantMessageId!,
    messages: allMessages,
  };

  await sendChatRequest("/api/ai/chat", { method: "POST", body: JSON.stringify(body) }, assistantMessageId!);
}

async function abortChatRequest() {
  const state = chatStore.getState();
  const lastMessage = state.messages.at(-1);
  if (lastMessage && lastMessage.role === "assistant" && lastMessage.status === "complete") return;

  console.log("[Chat] Aborting chat request");
  state.abortController.abort();

  await convexClient.mutation(api.messages.updateMessageById, {
    messageId: state.messages.at(-1)!._id,
    updates: { status: "error", error: "User have aborted the request." },
  });
}

export function ChatTextarea() {
  const router = useRouter();

  const status = useChatStore((state) => state.status);
  const config = useChatStore((state) => state.chatConfig);
  const setChatConfig = useChatStore((state) => state.setChatConfig);

  const setTextareaHeight = useChatStore((state) => state.setTextareaHeight);

  const input = useChatStore((state) => state.chatInput);
  const setChatInput = useChatStore((state) => state.setChatInput);

  const parentRef = useRef<HTMLDivElement>(null);

  function onResize(entries: ResizeObserverEntry[]) {
    const entry = entries[0];
    if (!entry) return;

    setTextareaHeight(entry.target.clientHeight);
  }

  useEffect(() => {
    if (!parentRef.current) return;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(parentRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <form className="absolute bottom-0 w-full px-4">
      <ScrollDownButton />

      <div
        ref={parentRef}
        className="bg-muted/40 border-border mx-auto max-w-4xl rounded-[calc(2px+8px)] rounded-b-none border border-b-0 p-2 pb-0 backdrop-blur-md backdrop-saturate-150"
      >
        <div className="bg-muted/60 border-border rounded-md rounded-b-none border border-b-0 p-2.5 pb-0">
          <Textarea
            rows={3}
            name="user-input"
            id="textarea-chat-input"
            value={input}
            placeholder="Type your message here..."
            onChange={(event) => setChatInput(event.target.value)}
            className="max-h-[250px] w-full resize-none rounded-none border-0 !bg-transparent p-0 text-sm !ring-0"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                void submitChatMessage(event, router);
              }
            }}
          />

          <div className="flex items-end justify-between">
            <div className="space-x-2 py-2">
              <ButtonWithTip
                type="button"
                variant="secondary"
                className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground h-max cursor-pointer border px-2 py-1.5 text-xs"
                data-active={config.webSearch}
                onMouseDown={() => setChatConfig({ webSearch: !config.webSearch })}
                title={config.webSearch ? "Disable Web Search" : "Enable Web Search"}
              >
                {config.webSearch ? <ToggleRightIcon /> : <ToggleLeftIcon />}
                Web Search
              </ButtonWithTip>

              <ButtonWithTip
                type="button"
                variant="secondary"
                className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground h-max cursor-pointer border px-2 py-1.5 text-xs"
                data-active={config.reasoning}
                onMouseDown={() => setChatConfig({ reasoning: !config.reasoning })}
                title={config.reasoning ? "Disable Reasoning" : "Enable Reasoning"}
              >
                {config.reasoning ? <ToggleRightIcon /> : <ToggleLeftIcon />}
                Reasoning
              </ButtonWithTip>
            </div>

            <Button
              type={status === "streaming" || status === "pending" ? "button" : "submit"}
              onMouseDown={(event) =>
                status === "streaming" || status === "pending" ? abortChatRequest() : submitChatMessage(event, router)
              }
              variant="outline"
              className="size-9 cursor-pointer rounded-b-none border-b-0 bg-transparent"
            >
              {status === "complete" || status === "error" ? (
                <SendHorizontalIcon className="size-4 -rotate-45" />
              ) : (
                <SquareIcon className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
