import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { getConvexReactClient } from "../convex/client";
import { processChatStream } from "./process-stream";
import { chatStore } from "./store";

import type { ChatMessage, ChatRequest } from "../types";
import { toUUID } from "../utils";
import { uploadFile } from "../convex/uploadFiles";

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
          case "text":
            content += stream.text;
            break;

          case "reasoning":
            reasoning += stream.text;
            break;

          case "finish":
            metadata = stream.messageMetadata as ChatMessage["metadata"];
            state.setStatus("complete");
            break;
        }

        state.setAssistantMessage({ id: assistantMessageId, content, reasoning, metadata });
      },
    });
  } catch (error) {
    if (!(error instanceof Error)) {
      console.warn("[Chat] Error:", error);
      return;
    }
    if (error.name === "AbortError") return;

    const errorMessage =
      "Failed to generate response. Please try again later. \nError: " + error.message;
    console.log("[Chat] Chat error:", error);

    void convexClient.mutation(api.messages.updateErrorMessage, {
      messageId: assistantMessageId,
      error: errorMessage,
    });
  } finally {
    state.setIsStreaming(false);
  }
}

type SubmitChatMessageParams = {
  router: ReturnType<typeof useRouter>;
};

export async function submitChatMessage({ router }: SubmitChatMessageParams) {
  const state = chatStore.getState();
  const chatInput = state.chatInput.trim();

  if (!chatInput || state.status === "streaming" || state.status === "pending") return;

  state.setChatInput("");
  state.setAttachment([]);
  state.setEditMessage(null);

  let threadId: Id<"threads"> = state.threadId!;
  if (!state.threadId) {
    threadId = await convexClient.mutation(api.threads.createThread, { title: "New Chat" });
    state.setThreadId(threadId);

    router.push(`/chat/${toUUID(threadId)}`);
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
        const attachmentId = await convexClient.mutation(api.attachments.createAttachment, {
          id: attachment.id,
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          threadId,
        });

        await uploadFile(attachment.file, threadId, attachmentId);
        userMessage.attachments.push(attachmentId);
      }),
    );
  }

  const assistantMessageId = await convexClient.mutation(api.messages.addMessagesToThread, {
    threadId,
    messages: [userMessage, assistantMessage],
  });

  const allMessages = state.messages.map((message) => ({
    id: message.messageId,
    role: message.role as "assistant" | "user",
    content: message.content,
    attachments: message.attachments?.map((attachment) => ({
      _id: attachment._id,
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
      if (!attachment) {
        throw new Error("Attachment not found");
      }
      return {
        _id: attachmentId,
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

  await convexClient.mutation(api.messages.updateErrorMessage, {
    messageId: state.messages.at(-1)!._id,
    error: "User have aborted the request.",
  });
}
