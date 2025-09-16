import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { sendChatRequest } from "./send-chat-request";
import { chatStore } from "./store";
import { firstNonEmptyOrLast } from "../utils";

import type { ChatRequest, ReasoningEffort } from "../types";

import { getConvexReactClient } from "@/lib/convex/client";

const convexClient = getConvexReactClient();

export async function retryMessage(
  index: number,
  threadId?: Id<"threads">,
  options?: {
    editedUserMessage?: { _id: Id<"messages">; content: string };
    modelId?: string;
    effort?: ReasoningEffort;
    webSearch?: boolean;
    attachmentsOverride?: Array<{
      _id: Id<"attachments">;
      id: string;
      threadId: Id<"threads">;
      name: string;
      size: number;
      type: "image" | "pdf";
      path: string;
    }>;
  },
) {
  if (!threadId) return;

  const state = chatStore.getState();
  state.setEditMessage(null);
  state.clearAssistantMessages();

  const editedUserMessage = options?.editedUserMessage;

  const userMessageIndex = index % 2 === 0 ? index : index - 1;
  const assistantMessage = state.messages[userMessageIndex + 1]!;

  const allMessages = state.messages.slice(0, userMessageIndex + 1).map((message, i) => ({
    id: message.messageId,
    role: message.role,
    content: message.content,
    attachments:
      i === userMessageIndex && options?.attachmentsOverride
        ? options.attachmentsOverride
        : message.attachments,
  }));

  const model = firstNonEmptyOrLast(
    options?.modelId,
    state.messages.at(-1)!.model,
    state.chatConfig.model,
  );

  await convexClient.mutation(api.functions.messages.retryChatMessage, {
    threadId,
    assistantMessageId: assistantMessage._id,
    model: model,
    userMessage: {
      messageId: state.messages[userMessageIndex]!._id,
      content: editedUserMessage?.content,
    },
  });

  if (editedUserMessage) {
    allMessages.at(-1)!.content = editedUserMessage.content;
  }

  if (options?.attachmentsOverride) {
    // reflect latest attachments for the edited user message in the outbound payload
    allMessages.at(-1)!.attachments = options.attachmentsOverride;
  }

  const config = {
    ...state.chatConfig,
    model,
    effort: options?.effort ?? state.chatConfig.effort,
    webSearch: options?.webSearch ?? state.chatConfig.webSearch,
  };

  const body: ChatRequest = {
    threadId,
    assistantMessageId: assistantMessage._id,
    messages: allMessages,
    config,
  };

  await sendChatRequest(
    "/api/ai/chat",
    { method: "POST", body: JSON.stringify(body) },
    assistantMessage._id,
    threadId,
  );
}
