import { api } from "@/convex/_generated/api";

import { SendHorizontalIcon } from "lucide-react";

import { Button } from "./ui/button";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore } from "@/lib/chat/store";
import { getConvexClient } from "@/lib/convex/client";
import type { ChatRequest } from "@/lib/types";
import { useChatStore } from "@/lib/chat/store";

const convexClient = getConvexClient();

async function submitChatMessage(event: { preventDefault: () => void }) {
  event.preventDefault();

  const state = useChatStore.getState();
  const chatInput = state.chatInput.trim();

  state.setChatInput("");

  const userMessage = {
    messageId: crypto.randomUUID(),
    content: chatInput,
    role: "user" as const,
    status: "complete" as const,
    model: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const assistantMessage = {
    messageId: crypto.randomUUID(),
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

  const allMessages = chatStore.getState().messages.map((message) => ({
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
    assistantMessageId: assistantMessageId!,
    messages: allMessages,
  };

  await sendChatRequest(body).then(() => {
    useChatStore.getState().setChatInput("");
  });
}

export function ChatTextarea() {
  const input = useChatStore((state) => state.chatInput);
  const setChatInput = useChatStore((state) => state.setChatInput);

  return (
    <form className="absolute bottom-0 w-full">
      <div className="bg-muted/40 mx-auto max-w-4xl rounded-[calc(2px+8px)] rounded-b-none p-2 pb-0 backdrop-blur-md backdrop-saturate-150">
        <div className="bg-muted/60 rounded-md rounded-b-none p-2.5">
          <textarea
            rows={3}
            name="user-input"
            value={input}
            onChange={(event) => setChatInput(event.target.value)}
            className="w-full resize-none text-sm outline-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                void submitChatMessage(event);
              }
            }}
          />

          <div className="flex items-center justify-between">
            <div></div>

            <Button type="submit" onClick={submitChatMessage} variant="outline" className="size-9 cursor-pointer">
              <SendHorizontalIcon className="size-4 -rotate-90" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
