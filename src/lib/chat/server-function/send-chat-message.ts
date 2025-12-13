import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex } from "convex/react";

import { useNavigate, useParams } from "@tanstack/react-router";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";

import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { messageStoreActions } from "@/lib/store/messages-store";
import type { ChatMessage, ChatRequestBody } from "@/lib/types";
import { fromUUID, toUUID } from "@/lib/utils";

import { convertToUIChatMessages } from "../shared";
import { createStreamResponseHandler } from "../stream-handler";

type CreateMessage =
  (typeof api.functions.messages.addMessagesToThread)["_args"]["messages"][number];

export function useSendChatMessage() {
  const navigate = useNavigate();
  const [id] = useSessionId();
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });

  const convexClient = useConvex();
  const { effort, webSearch, model } = useConfigStore(
    useShallow((state) => ({
      model: state.model,
      effort: state.effort,
      webSearch: state.webSearch,
    })),
  );

  async function sendChatRequest() {
    const sessionId = id!;
    let threadId: Id<"threads"> | null = fromUUID<Id<"threads">>(params?.threadId) ?? null;
    const { input } = useChatStore.getState();

    const messagesHistory = messageStoreActions
      .getMessages()
      .sort((a, b) => a.createdAt - b.createdAt);
    const lastMessage = messagesHistory[messagesHistory.length - 1];

    if (!input || lastMessage?.status === "pending" || lastMessage?.status === "streaming") return;
    chatStoreActions.resetInput();

    if (!threadId) {
      threadId = await convexClient.mutation(api.functions.threads.createThread, { sessionId });
      await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(threadId) } });
    }

    const abortController = new AbortController();
    messageStoreActions.setController(threadId, abortController);

    const userMessage: CreateMessage = {
      messageId: crypto.randomUUID(),
      role: "user" as const,
      status: "complete" as const,
      parts: [{ type: "text", text: input, state: "done" }],
      attachments: [],
    };

    const assistantMessage: CreateMessage = {
      messageId: crypto.randomUUID(),
      role: "assistant" as const,
      status: "pending" as const,
      parts: [],
      attachments: [],
      metadata: {
        model: { request: model, response: null },
        finishReason: "",
        timeToFirstTokenMs: 0,
        usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
        durations: { request: 0, reasoning: 0, text: 0 },
        modelParams: { effort, webSearch, profile: null },
      },
    };

    const assistantMessageId = await convexClient.mutation(
      api.functions.messages.addMessagesToThread,
      { sessionId, threadId, messages: [userMessage, assistantMessage] },
    );

    const messages = convertToUIChatMessages(messagesHistory);

    messages.push({
      role: "user" as const,
      id: userMessage.messageId,
      parts: [{ type: "text", text: input }],
    });

    const body: ChatRequestBody = {
      model,
      threadId,
      messages,
      assistantMessageId,
      modelParams: { effort, webSearch, profile: null },
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

  return { sendChatRequest };
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
