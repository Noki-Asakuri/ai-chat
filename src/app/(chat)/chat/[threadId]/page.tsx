"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

import { use, useState } from "react";
import { toast } from "sonner";

import { Message } from "@/components/message";

import { getConvexReactClient } from "@/lib/convex/client";
import type { ChatRequest } from "@/lib/types";

const convexClient = getConvexReactClient();

async function sendChatRequest(
  event: { preventDefault: () => void },
  threadId: string,
  input: string,
  messages: { messageId: string; content: string; role: string }[],
) {
  event.preventDefault();

  const userMessageId = crypto.randomUUID();
  const userMessage = {
    messageId: userMessageId,
    content: input,
    role: "user" as const,
    status: "complete" as const,
    model: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const assistantMessageId = crypto.randomUUID();
  const assistantMessage = {
    messageId: assistantMessageId,
    content: "",
    role: "assistant" as const,
    status: "pending" as const,
    model: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await convexClient.mutation(api.messages.addMessagesToThread, {
    threadId,
    messages: [userMessage, assistantMessage],
  });

  const allMessages = messages.map((message) => ({
    id: message.messageId,
    role: message.role as "assistant" | "user",
    content: message.content,
  }));

  allMessages.push({
    role: "user",
    content: input,
    id: userMessageId,
  });

  const body: ChatRequest = {
    threadId,
    assistantMessageId,
    messages: allMessages,
  };

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return toast.error("Failed to send message");
  }
}

export default function Page({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const [input, setInput] = useState("");

  const messages = useQuery(api.messages.getAllMessagesFromThread, { threadId });
  if (!messages) return null;

  return (
    <div className="h-svh max-w-screen px-4 py-6 pb-0">
      <div className="relative container mx-auto flex h-full max-w-4xl flex-col">
        <div className="flex flex-col gap-2 overflow-y-auto px-2 pb-33">
          {messages.map((message) => (
            <Message key={message.messageId} message={message} />
          ))}
        </div>

        <form className="bg-muted/60 absolute bottom-0 mt-auto w-full rounded-md rounded-b-none p-3 backdrop-blur-md backdrop-saturate-150">
          <textarea
            rows={3}
            name="user-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendChatRequest(event, threadId, input, messages);
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
