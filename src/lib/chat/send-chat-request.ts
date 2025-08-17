import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { v4 as uuidv4 } from "uuid";

import { getConvexReactClient } from "../convex/client";
import { uploadFile } from "../convex/uploadFiles";

import { branchOffThreadMessage } from "./action-branch-off";
import { processChatStream } from "./process-stream";
import { retryMessage } from "./retry-message";
import { chatStore } from "./store";

import type { ChatMessage, ChatRequest } from "../types";
import { fixMarkdownCodeBlocks, fromUUID, toUUID } from "../utils";

const convexClient = getConvexReactClient();

export async function sendChatRequest(
  url: string | URL,
  init: RequestInit | undefined,
  assistantMessageId: Id<"messages">,
) {
  const state = chatStore.getState();

  state.setIsStreaming(true);
  state.setStatus("streaming");

  let abortController = state.abortController;
  if (abortController.signal.aborted) {
    abortController = new AbortController();
    state.setAbortController(abortController);
  }

  try {
    let content = "";
    let reasoning = "";
    let metadata: ChatMessage["metadata"] | undefined;

    await processChatStream({
      fetch: fetch(url, { ...init, signal: abortController.signal }),
      handler: async (stream) => {
        switch (stream.type) {
          case "text-delta":
            content += stream.delta;
            break;

          case "reasoning-start":
            const isStarting =
              stream.id.endsWith(":0") &&
              stream.providerMetadata &&
              "openai" in stream.providerMetadata;

            // OpenAI seperate reasoning part with new 'reasoning-start' event
            if (!isStarting) reasoning += "\n\n";
            break;

          case "reasoning-delta":
            reasoning += stream.delta;
            break;

          case "finish":
            metadata = stream.messageMetadata as ChatMessage["metadata"];
            state.setStatus("complete");
            break;
        }

        content = fixMarkdownCodeBlocks(content);
        state.setAssistantMessage({ id: assistantMessageId, content, reasoning, metadata });
      },
    });
  } catch (error) {
    if (!(error instanceof Error)) {
      console.warn("[Chat] Error:", error);
      return;
    }
    if (error.name === "AbortError") return;

    console.log("[Chat] Chat error:", error);
    const errorMessage = "Failed to generate response. \n\nError: " + error.message;

    void convexClient.mutation(api.functions.messages.updateErrorMessage, {
      error: errorMessage,
      model: state.chatConfig.model,
      messageId: assistantMessageId,
    });
  } finally {
    state.setIsStreaming(false);
  }
}

type SubmitChatMessageParams = {
  navigate: ReturnType<typeof useNavigate>;
  threadId?: Id<"threads">;
};

export async function submitChatMessage({ navigate, threadId }: SubmitChatMessageParams) {
  const state = chatStore.getState();
  const chatInput = state.chatInput.trim();

  if (!chatInput || state.status === "streaming" || state.status === "pending") return;

  state.setChatInput("");
  window.localStorage.removeItem("chatInput");
  state.setAttachment([]);
  state.setEditMessage(null);

  // Force UI to stick to bottom on user send action
  try {
    window.dispatchEvent(new Event("chat:force-scroll-bottom"));
  } catch {
    // ignore if window not available
  }

  // Force UI to stick to bottom on user send action
  try {
    window.dispatchEvent(new Event("chat:force-scroll-bottom"));
  } catch {
    // ignore if window not available
  }

  if (!threadId) {
    threadId = await convexClient.mutation(api.functions.threads.createThread, {
      title: "New Chat",
    });

    await navigate(`/threads/${toUUID(threadId)}`);
  }

  const userMessage = {
    messageId: uuidv4(),
    content: chatInput,
    role: "user" as const,
    status: "complete" as const,
    model: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attachments: [] as Id<"attachments">[],
  };

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

  if (state.attachments.length) {
    await Promise.all(
      state.attachments.map(async (attachment) => {
        const attachmentId = await convexClient.mutation(
          api.functions.attachments.createAttachment,
          {
            id: attachment.id,
            name: attachment.name,
            size: attachment.size,
            type: attachment.type,
            threadId,
          },
        );

        await uploadFile(attachment.file, threadId, attachmentId);
        userMessage.attachments.push(attachmentId);
      }),
    );
  }

  const assistantMessageId = await convexClient.mutation(
    api.functions.messages.addMessagesToThread,
    {
      threadId,
      messages: [userMessage, assistantMessage],
    },
  );

  const allMessages = state.messages.map((message) => ({
    id: message.messageId,
    role: message.role as "assistant" | "user",
    content: message.content,
    attachments: message.attachments?.map((attachment) => ({
      _id: attachment._id,
      id: attachment.id,
      threadId: attachment.threadId,

      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
    })),
  }));

  allMessages.push({
    role: "user",
    content: chatInput,
    id: userMessage.messageId,
    attachments: userMessage.attachments.map((attachmentId, index) => {
      const attachment = state.attachments[index];
      if (!attachment) throw new Error("Attachment not found");

      return {
        _id: attachmentId,
        id: attachment.id,
        threadId,

        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
      };
    }),
  });

  const body: ChatRequest = {
    threadId,
    messages: allMessages,
    config: state.chatConfig,
    assistantMessageId: assistantMessageId!,
    profile: {
      id: state.chatConfig.profile.id as Id<"ai_profiles"> | null,
      systemPrompt: state.chatConfig.profile.systemPrompt,
    },
  };

  await sendChatRequest(
    "/api/ai/chat",
    { method: "POST", body: JSON.stringify(body) },
    assistantMessageId!,
  );
}

export async function abortChatRequest() {
  const state = chatStore.getState();
  const lastMessage = state.messages.at(-1);
  if (lastMessage && lastMessage.role === "assistant" && lastMessage.status === "complete") return;

  console.log("[Chat] Aborting chat request");
  state.abortController.abort();

  await convexClient.mutation(api.functions.messages.updateErrorMessage, {
    model: state.chatConfig.model,
    messageId: state.messages.at(-1)!._id,
    error: "User have aborted the request.",
  });
}

export function useChatRequest() {
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId: string }>();

  const retryMessageCallback = useCallback(
    async (
      index: number,
      options?: {
        editedUserMessage?: { _id: Id<"messages">; content: string };
        modelId?: string;
      },
    ) => {
      await retryMessage(index, fromUUID<Id<"threads">>(threadId), options);
    },
    [threadId],
  );

  const submitChatMessageCallback = useCallback(
    () => submitChatMessage({ navigate, threadId: fromUUID<Id<"threads">>(threadId) }),
    [navigate, threadId],
  );

  const abortChatRequestCallback = useCallback(() => abortChatRequest(), []);

  const branchOffThreadMessageCallBack = useCallback(
    (message: ChatMessage) => branchOffThreadMessage(message, navigate),
    [navigate],
  );

  return {
    retryMessage: retryMessageCallback,
    abortChatRequest: abortChatRequestCallback,
    submitChatMessage: submitChatMessageCallback,
    branchOffThreadMessage: branchOffThreadMessageCallBack,
  };
}
