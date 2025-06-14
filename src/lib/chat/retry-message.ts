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

  state.setEditMessage(null);

  const userMessageIndex = index % 2 === 0 ? index : index - 1;
  const assistantMessage = state.messages[userMessageIndex + 1]!;

  const allMessages = state.messages.slice(0, userMessageIndex + 1).map((message) => ({
    id: message.messageId,
    role: message.role,
    content: message.content,
    attachments: message.attachments?.map((attachment) => attachment._id),
  }));

  await convexClient.mutation(api.messages.retryChatMessage, {
    threadId,
    assistantMessageId: assistantMessage._id,
    userMessage: {
      messageId: state.messages[userMessageIndex]!._id,
      content: editedUserMessage?.content,
    },
  });

  if (editedUserMessage) {
    allMessages.at(-1)!.content = editedUserMessage.content;
  }

  const body: ChatRequest = {
    threadId,
    assistantMessageId: assistantMessage._id,
    messages: allMessages,
    config: state.chatConfig,
  };

  await sendChatRequest(
    "/api/ai/chat",
    { method: "POST", body: JSON.stringify(body) },
    assistantMessage._id,
  );
}
