import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { sendChatRequest } from "./send-chat-request";
import { chatStore } from "./store";

import type { ChatRequestBody, ReasoningEffort } from "../types";
import { firstNonEmptyOrLast } from "../utils";

import { getConvexReactClient } from "@/lib/convex/client";
import { convertV4MessageToV5 } from "./conversion";

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
    parts: message.parts,
    attachments:
      i === userMessageIndex && options?.attachmentsOverride
        ? options.attachmentsOverride
        : message.attachments,
  }));

  const lastMessage = state.messages.at(-1)!;

  const model = firstNonEmptyOrLast(options?.modelId, lastMessage.model, state.chatConfig.model);
  const profileId = lastMessage.metadata?.profile?.id ?? state.chatConfig.profile?.id;

  const profile = state.profiles.find((p) => p._id === profileId);
  const activeProfile = profile
    ? { id: profile._id, name: profile.name, systemPrompt: profile.systemPrompt }
    : state.chatConfig.profile;

  state.setChatConfig({ model, profile: activeProfile });

  const userMessageParts = editedUserMessage?.content
    ? convertV4MessageToV5(
        {
          role: "user",
          id: state.messages[userMessageIndex]!.messageId,
          content: editedUserMessage?.content,
        },
        0,
      )
    : undefined;

  await convexClient.mutation(api.functions.messages.retryChatMessage, {
    threadId,
    assistantMessageId: assistantMessage._id,
    model: model,
    modelParams: {
      webSearchEnabled: options?.webSearch ?? state.chatConfig.webSearch,
      effort: options?.effort ?? state.chatConfig.effort,
    },
    userMessage: {
      messageId: state.messages[userMessageIndex]!._id,
      content: editedUserMessage?.content,
      parts: userMessageParts?.parts,
    },
  });

  if (editedUserMessage) {
    allMessages.at(-1)!.content = editedUserMessage.content;
    allMessages.at(-1)!.parts = userMessageParts!.parts;
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
    profile: activeProfile,
  };

  const body: ChatRequestBody = {
    threadId,
    assistantMessageId: assistantMessage._id,
    messages: allMessages,
    config,
  };

  await sendChatRequest(
    "/api/ai/chat",
    { method: "POST", body: JSON.stringify(body) },
    assistantMessage._id,
  );
}
