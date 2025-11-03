import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { v4 as uuidv4 } from "uuid";

import { getConvexReactClient } from "../convex/client";
import { uploadFile } from "../convex/uploadFiles";

import { branchOffThreadMessage } from "./action-branch-off";
import { convertV4MessageToV5 } from "./conversion";
import { processChatStream } from "./process-stream";
import { retryMessage } from "./retry-message";
import { chatStore } from "./store";

import type { ChatMessage, ChatRequestBody } from "../types";
import { fixMarkdownCodeBlocks, fromUUID, toUUID, tryCatch, tryCatchSync } from "../utils";

import { env } from "@/env";

const convexClient = getConvexReactClient();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wait until the server (Convex) has persisted the assistant message as "complete".
// This prevents clearing the client-side streaming overlay too early which causes UI flicker.
async function waitForServerSyncForMessage(
  assistantMessageId: Id<"messages">,
  timeoutMs = 10000,
  intervalMs = 200,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = chatStore.getState();
    const msg = s.messages.find((m) => m._id === assistantMessageId);
    if (msg && msg.status === "complete" && (msg.content?.length ?? 0) > 0) return;

    // Polling here is intentional to wait for server sync without introducing effects.
    await sleep(intervalMs);
  }
}

export async function sendChatRequest(
  path: string | URL,
  init: RequestInit | undefined,
  assistantMessageId: Id<"messages">,
) {
  const state = chatStore.getState();
  state.markStreamStart(assistantMessageId);

  let abortController = state.getController(assistantMessageId);
  if (!abortController || abortController.signal.aborted) {
    abortController = new AbortController();
    state.setController(assistantMessageId, abortController);
  }

  try {
    let content = "";
    let reasoning = "";
    let metadata: ChatMessage["metadata"] | undefined;

    const url = new URL(path, env.NEXT_PUBLIC_API_ENDPOINT);

    await processChatStream({
      fetch: fetch(url, { ...init, signal: abortController.signal, credentials: "include" }),
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

          case "file": {
            // Early client-side preview for streamed image data URLs
            state.addPreviewImage(assistantMessageId, {
              src: stream.url,
              mediaType: stream.mediaType,
            });
            break;
          }

          case "finish":
            metadata = stream.messageMetadata as ChatMessage["metadata"];
            break;
        }

        const v5Message = convertV4MessageToV5(
          { id: assistantMessageId, role: "assistant", content, reasoning },
          0,
        );

        content = fixMarkdownCodeBlocks(content);
        state.setAssistantMessage({ id: assistantMessageId, parts: v5Message.parts, metadata });
      },
    });
  } catch (rawError) {
    const error = new Error(rawError as string);
    if (error.name === "AbortError") return;

    console.log("[Chat] Chat error:", error);
    const errorMessage = `Receieved an error from the server.\n\n${error.message}`;

    await convexClient.mutation(api.functions.messages.updateErrorMessage, {
      error: errorMessage,
      model: state.chatConfig.model,
      modelParams: {
        webSearchEnabled: state.chatConfig.webSearch,
        effort: state.chatConfig.effort,
      },
      messageId: assistantMessageId,
    });
  } finally {
    // Clear controller
    state.clearController(assistantMessageId);

    // Wait for server to finish persisting the assistant message before clearing the client overlay.
    // This avoids a flicker where the message briefly returns to a loading state.
    if (!abortController.signal.aborted) {
      // Ignore wait errors/timeouts; fall through to clear overlay to avoid leaks.
      await tryCatch(waitForServerSyncForMessage(assistantMessageId));
    }

    // Mark stream end after server have persisted the message
    state.markStreamEnd(assistantMessageId);

    // Drop in-memory overlay to avoid leaks (Convex holds the persisted message)
    state.clearAssistantMessage(assistantMessageId);
  }
}

type SubmitChatMessageParams = {
  navigate: ReturnType<typeof useNavigate>;
  threadId?: Id<"threads">;
};

export async function submitChatMessage({ navigate, threadId }: SubmitChatMessageParams) {
  const state = chatStore.getState();
  const status = state.messages.at(-1)?.status;
  const chatInput = state.chatInput.trim();

  if (!chatInput || status === "streaming" || status === "pending") return;

  state.setChatInput("");
  window.localStorage.removeItem("chatInput");
  state.setAttachment([]);
  state.setEditMessage(null);

  tryCatchSync(() => {
    window.dispatchEvent(new Event("chat:force-scroll-bottom"));
  });

  if (!threadId) {
    threadId = await convexClient.mutation(api.functions.threads.createThread, {});
    await navigate(`/threads/${toUUID(threadId)}`);
  }

  const uploadedAttachmentPaths = new Map<Id<"attachments">, string>();

  type CreateMessage =
    (typeof api.functions.messages.addMessagesToThread)["_args"]["messages"][number];

  const userMessage: CreateMessage = {
    messageId: uuidv4(),
    content: chatInput,
    role: "user" as const,
    status: "complete" as const,
    parts: convertV4MessageToV5({ id: uuidv4(), role: "user", content: chatInput }, 0).parts,
    model: state.chatConfig.model,
    modelParams: {
      webSearchEnabled: state.chatConfig.webSearch,
      effort: state.chatConfig.effort,
    },

    createdAt: Date.now(),
    updatedAt: Date.now(),
    attachments: [] as Id<"attachments">[],
  };

  const assistantMessage: CreateMessage = {
    messageId: uuidv4(),
    content: "",
    role: "assistant" as const,
    status: "pending" as const,
    parts: [],
    model: state.chatConfig.model,
    modelParams: {
      webSearchEnabled: state.chatConfig.webSearch,
      effort: state.chatConfig.effort,
    },

    createdAt: Date.now(),
    updatedAt: Date.now(),
    attachments: [] as Id<"attachments">[],
  };

  if (state.attachments.length) {
    await Promise.all(
      state.attachments.map(async (attachment) => {
        const { docId, uniqueId } = await convexClient.mutation(
          api.functions.attachments.createAttachment,
          {
            threadId,
            id: attachment.id,
            name: attachment.name,
            size: attachment.size,
            type: attachment.type,
            source: "user",
            mimeType: attachment.file.type,
          },
        );

        const key = await uploadFile(attachment.file, threadId, uniqueId);
        userMessage.attachments.push(docId);
        uploadedAttachmentPaths.set(docId, key);
      }),
    );
  }

  const assistantMessageId = await convexClient.mutation(
    api.functions.messages.addMessagesToThread,
    { threadId, messages: [userMessage, assistantMessage] },
  );

  const allMessages = state.messages.map((message) => ({
    id: message.messageId,
    role: message.role,
    content: message.content,
    attachments: message.attachments?.map((attachment) => ({
      _id: attachment._id,
      id: attachment.id,
      threadId: attachment.threadId,

      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
      path: attachment.path,
    })),
  }));

  allMessages.push({
    role: "user",
    content: chatInput,
    id: userMessage.messageId,
    attachments: userMessage.attachments.map((attachmentId, index) => {
      const attachment = state.attachments[index];
      const path = uploadedAttachmentPaths.get(attachmentId)!;
      if (!attachment) throw new Error("Attachment not found");

      return {
        _id: attachmentId,
        id: attachment.id,
        threadId,

        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
        path,
      };
    }),
  });

  const body: ChatRequestBody = {
    threadId,
    messages: allMessages,
    config: state.chatConfig,
    assistantMessageId,
  };

  await sendChatRequest(
    "/api/ai/chat",
    { method: "POST", body: JSON.stringify(body) },
    assistantMessageId,
  );
}

export async function abortChatRequest() {
  const state = chatStore.getState();

  const lastMessage = state.messages.at(-1);
  if (!lastMessage || lastMessage.role !== "assistant") return;
  if (lastMessage.status === "complete") return;

  console.log("[Chat] Aborting chat request");

  const controller = state.getController(lastMessage._id);
  if (controller && !controller.signal.aborted) {
    controller.abort();
  }

  await convexClient.mutation(api.functions.messages.updateErrorMessage, {
    messageId: lastMessage._id,
    model: state.chatConfig.model,
    modelParams: {
      webSearchEnabled: state.chatConfig.webSearch,
      effort: state.chatConfig.effort,
    },
    error: "User have aborted the request.",
  });

  // Mark stream ended locally
  state.clearController(lastMessage._id);
  state.markStreamEnd(lastMessage._id);
}

export function useChatRequest() {
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId: string }>();

  const retryMessageCallback = useCallback(
    (index: number, options: Parameters<typeof retryMessage>[2]) => {
      return retryMessage(index, fromUUID<Id<"threads">>(threadId), options);
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
