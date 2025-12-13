import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex } from "convex/react";

import { messageStoreActions } from "@/lib/store/messages-store";
import type { ChatMessage, ChatRequestBody } from "@/lib/types";

import { convertToUIChatMessages } from "../shared";
import { createStreamResponseHandler } from "../stream-handler";

type RetryChatMessage = {
  index: number;

  modelId?: string;
  modelParams?: Partial<NonNullable<ChatMessage["metadata"]>["modelParams"]>;

  userMessage?: {
    messageId: Id<"messages">;
    parts: ChatMessage["parts"];
    attachments: Id<"attachments">[];
  };
};

export function useRetryChatMessage() {
  const [id] = useSessionId();
  const convexClient = useConvex();

  async function retryChatMessage({ index, ...options }: RetryChatMessage) {
    const sessionId = id!;

    const threadId = messageStoreActions.getCurrentThreadId();
    if (!threadId) return;

    const messagesHistory = messageStoreActions
      .getMessages()
      .sort((a, b) => a.createdAt - b.createdAt);

    const abortController = new AbortController();
    messageStoreActions.setController(threadId, abortController);

    // Find the user message and assistant response pair
    const userMessageIndex = index % 2 === 0 ? index : index - 1;
    const assistantMessage = messagesHistory[userMessageIndex + 1]!;

    const assistantMessageId = assistantMessage._id;

    const allMessages = convertToUIChatMessages(messagesHistory.slice(0, userMessageIndex + 1));

    const model = options.modelId ?? assistantMessage.metadata!.model.request;
    const modelParams = {
      ...assistantMessage.metadata!.modelParams,
      ...options.modelParams,
    };

    await convexClient.mutation(api.functions.messages.retryChatMessage, {
      sessionId,
      threadId,
      assistantMessageId,

      model,
      modelParams,

      userMessage: options.userMessage,
    });

    const body: ChatRequestBody = {
      model,
      threadId,
      messages: allMessages,
      assistantMessageId,
      modelParams,
    };

    const response = await fetch(new URL("/api/ai/chat", import.meta.env.VITE_API_ENDPOINT), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    await processStreamResponse(response, assistantMessageId, threadId);
    messageStoreActions.removeController(threadId);
  }

  return { retryChatMessage };
}

async function processStreamResponse(
  response: Response,
  messageId: Id<"messages">,
  threadId: Id<"threads">,
) {
  const iterable = createStreamResponseHandler(response);

  for await (const message of iterable) {
    const activeThreadId = messageStoreActions.getCurrentThreadId();
    if (activeThreadId !== threadId) continue;

    messageStoreActions.updateMessageById(messageId, {
      parts: message.parts as ChatMessage["parts"],
    });
  }
}
