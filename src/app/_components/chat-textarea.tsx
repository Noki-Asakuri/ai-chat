import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

import { useParams, useRouter } from "next/navigation";

import { Loader2Icon, SendHorizontalIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { Button } from "./ui/button";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { getConvexClient } from "@/lib/convex/client";
import type { ChatRequest } from "@/lib/types";
import { useChatStore } from "@/lib/chat/store";
import { ScrollDownButton } from "./scroll-down-button";

const convexClient = getConvexClient();

async function submitChatMessage(
  event: { preventDefault: () => void },
  router: ReturnType<typeof useRouter>,
  currentThreadId?: string,
) {
  event.preventDefault();

  const state = useChatStore.getState();
  const chatInput = state.chatInput.trim();

  if (state.status === "streaming") return;

  state.setChatInput("");
  let _threadId: Id<"threads"> | undefined = undefined;

  if (typeof currentThreadId === "undefined") {
    const thread = { threadId: state.threadId, title: "New Chat" };
    _threadId = await convexClient.mutation(api.threads.createThread, thread);
    state.rotateNewThreadId();

    router.push(`/chat/${thread.threadId}`);
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
    threadId: state.threadId,
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
    threadId: state.threadId,
    _threadId,
    assistantMessageId: assistantMessageId!,
    messages: allMessages,
  };

  await sendChatRequest(body);
}

export function ChatTextarea() {
  const params = useParams<{ threadId?: string }>();
  const router = useRouter();

  const status = useChatStore((state) => state.status);

  const input = useChatStore((state) => state.chatInput);
  const setChatInput = useChatStore((state) => state.setChatInput);

  return (
    <form className="absolute bottom-0 w-full">
      <ScrollDownButton />

      <div className="bg-muted/40 border-border mx-auto max-w-4xl rounded-[calc(2px+8px)] rounded-b-none border border-b-0 p-2 pb-0 backdrop-blur-md backdrop-saturate-150">
        <div className="bg-muted/60 border-border rounded-md rounded-b-none border p-2.5 pb-0">
          <textarea
            rows={3}
            name="user-input"
            value={input}
            onChange={(event) => setChatInput(event.target.value)}
            className="w-full resize-none text-sm outline-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                void submitChatMessage(event, router, params.threadId);
              }
            }}
          />

          <div className="flex items-end justify-between">
            <div className="space-x-2 py-2">
              <Button
                type="button"
                className="bg-muted/70 focus:bg-muted text-foreground border-border h-max cursor-pointer border px-2 py-1.5 text-sm"
              >
                Web Search
              </Button>

              <Button
                type="button"
                className="bg-muted/70 focus:bg-muted text-foreground border-border h-max cursor-pointer border px-2 py-1.5 text-sm"
              >
                Reasoning
              </Button>
            </div>

            <Button
              type="submit"
              onMouseDown={(event) => submitChatMessage(event, router, params.threadId)}
              variant="outline"
              className="size-9 cursor-pointer rounded-b-none border-b-0 bg-transparent"
            >
              {status === "complete" || status === "error" ? (
                <SendHorizontalIcon className="size-4 -rotate-45" />
              ) : (
                <Loader2Icon className="size-4 animate-spin" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
