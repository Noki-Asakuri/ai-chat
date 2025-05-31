"use client";

import { api } from "@/convex/_generated/api";

import { use, useState } from "react";

import { ChatMessages } from "@/components/message";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore, useChatStore } from "@/lib/chat/store";
import { getConvexReactClient } from "@/lib/convex/client";
import type { ChatRequest } from "@/lib/types";

const convexClient = getConvexReactClient();

async function submitChatMessage(event: { preventDefault: () => void }, threadId: string, input: string) {
  event.preventDefault();

  const userMessage = {
    messageId: crypto.randomUUID(),
    content: input,
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
    threadId,
    messages: [userMessage, assistantMessage],
  });

  const allMessages = chatStore.getState().messages.map((message) => ({
    id: message.messageId,
    role: message.role as "assistant" | "user",
    content: message.content,
  }));

  allMessages.push({
    role: "user",
    content: input,
    id: userMessage.messageId,
  });

  const body: ChatRequest = {
    threadId,
    assistantMessageId: assistantMessageId!,
    messages: allMessages,
  };

  await sendChatRequest(body);
}

export default function Page({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const [input, setInput] = useState("");

  return (
    <div className="h-svh max-w-screen px-4 py-6 pb-0">
      <div className="relative container mx-auto flex h-full max-w-4xl flex-col">
        <ChatMessages />

        <form className="bg-muted/60 absolute bottom-0 mt-auto w-full rounded-md rounded-b-none p-3 backdrop-blur-md backdrop-saturate-150">
          <textarea
            rows={3}
            name="user-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitChatMessage(event, threadId, input);
                setInput("");
              }
            }}
            className="bg-mute/70 w-full p-2 outline-none"
          />
        </form>
      </div>
    </div>
  );
}
