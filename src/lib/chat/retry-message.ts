import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { sendChatRequest } from "./send-chat-request";
import { chatStore } from "./store";

import type { ChatRequest } from "../types";

import { getConvexReactClient } from "@/lib/convex/client";

const convexClient = getConvexReactClient();

export async function retryMessage(
  index: number,
  threadId?: Id<"threads">,
  options?: {
    editedUserMessage?: { _id: Id<"messages">; content: string };
    modelId?: string;
  },
) {
  if (!threadId) return;

  const state = chatStore.getState();
  state.setEditMessage(null);
  state.setAssistantMessage({ id: "", content: "", reasoning: "", metadata: undefined });

  const editedUserMessage = options?.editedUserMessage;

  const userMessageIndex = index % 2 === 0 ? index : index - 1;
  const assistantMessage = state.messages[userMessageIndex + 1]!;

  const allMessages = state.messages.slice(0, userMessageIndex + 1).map((message) => ({
    id: message.messageId,
    role: message.role,
    content: message.content,
    attachments: message.attachments,
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

  const config = {
    ...state.chatConfig,
    model: options?.modelId ?? state.chatConfig.model,
  };

  // Resolve selected AI profile's system prompt client-side and send as plain text
  let profileSystemPrompt: string | undefined;
  const selectedProfileId = state.selectedAiProfileId;
  if (selectedProfileId) {
    try {
      const profile = await convexClient.query(api.aiProfiles.getProfile, {
        profileId: selectedProfileId,
      });
      if (profile?.systemPrompt && profile.systemPrompt.trim().length > 0) {
        profileSystemPrompt = profile.systemPrompt;
      }
    } catch {
      // Ignore failures to fetch profile; proceed without a profile prompt
    }
  }

  const body: ChatRequest = {
    threadId,
    assistantMessageId: assistantMessage._id,
    messages: allMessages,
    config,
    profileSystemPrompt,
  };

  await sendChatRequest(
    "/api/ai/chat",
    { method: "POST", body: JSON.stringify(body) },
    assistantMessage._id,
  );
}
