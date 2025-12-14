import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex } from "convex/react";

import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage, ChatRequestBody } from "@/lib/types";

import { convertToUIChatMessages, processStreamResponse } from "../shared";

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
    const messageState = useMessageStore.getState();

    const threadId = messageState.currentThreadId;
    if (!threadId) return;

    const messagesHistory = messageState.messageIds
      .map((id) => messageState.messagesById[id]!)
      .sort((a, b) => a.createdAt - b.createdAt);

    const abortController = new AbortController();
    messageStoreActions.setController(threadId, abortController);

    // Find the user message and assistant response pair
    const userMessageIndex = index % 2 === 0 ? index : index - 1;
    const assistantMessage = messagesHistory[userMessageIndex + 1]!;

    const assistantMessageId = assistantMessage._id;

    const historySlice = messagesHistory.slice(0, userMessageIndex + 1);

    if (options.userMessage) {
      const userMessage = historySlice[userMessageIndex]!;
      historySlice[userMessageIndex] = { ...userMessage, parts: options.userMessage.parts };
    }

    const allMessages = convertToUIChatMessages(historySlice);

    const model = options.modelId ?? assistantMessage.metadata!.model.request;
    const mergedModelParams = {
      ...assistantMessage.metadata!.modelParams,
      ...options.modelParams,
    };

    const mutationModelParams = {
      ...mergedModelParams,
      profile: mergedModelParams.profile ?? null,
    };

    await convexClient.mutation(api.functions.messages.retryChatMessage, {
      sessionId,
      threadId,
      assistantMessageId,

      model,
      modelParams: mutationModelParams,

      userMessage: options.userMessage,
    });

    const bodyModelParams: ChatRequestBody["modelParams"] = {
      effort: mutationModelParams.effort,
      webSearch: mutationModelParams.webSearch,
      profile: null,
    };

    const body: ChatRequestBody = {
      model,
      threadId,
      messages: allMessages,
      assistantMessageId,
      modelParams: bodyModelParams,
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
