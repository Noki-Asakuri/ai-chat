import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { v4 as uuidv4 } from "uuid";

import { sendChatRequest } from "./send-chat-request";
import { chatStore } from "./store";

import type { ChatRequest } from "../types";

import { getConvexReactClient } from "@/lib/convex/client";

const convexClient = getConvexReactClient();

export async function retryMessage(
  index: number,
  editedUserMessage?: { _id: Id<"messages">; content: string },
) {
  const state = chatStore.getState();
  const threadId = state.threadId!;

  const userMessageIndex = index % 2 === 0 ? index : index - 1;
  const allMessages = state.messages.slice(0, userMessageIndex + 1).map((message) => ({
    id: message.messageId,
    role: message.role,
    content: message.content,
    attachments: message.attachments?.map((attachment) => attachment._id),
  }));

  const assistantMessage = {
    messageId: uuidv4(),
    content: "",
    role: "assistant" as const,
    status: "pending" as const,
    model: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attachments: [] as Id<"attachments">[],
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
    threadId,
    assistantMessageId,
    messages: allMessages,
    config: state.chatConfig,
  };

  await sendChatRequest(
    "/api/ai/chat",
    { method: "POST", body: JSON.stringify(body) },
    assistantMessageId,
  );
}
