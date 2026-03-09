import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex } from "convex/react";
import { toast } from "sonner";

import { useNavigate, useParams } from "@tanstack/react-router";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";

import { buildAttachmentUrl } from "@/lib/assets/urls";
import { setStickyToBottom } from "@/lib/chat/scroll-stickiness";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage, ChatRequestBody } from "@/lib/types";
import { fromUUID, toUUID, tryCatch } from "@/lib/utils";

import { convertToUIChatMessages, processStreamResponse, uploadUserAttachment } from "../shared";
import {
  getClientErrorMessage,
  getDeprecatedModelError,
  isAbortError,
  throwIfChatResponseError,
} from "./chat-errors";

type CreateMessage =
  (typeof api.functions.messages.addMessagesToThread)["_args"]["messages"][number];

export function useSendChatMessage() {
  const navigate = useNavigate();
  const [id] = useSessionId();
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });
  const configStore = useConfigStoreState();

  const convexClient = useConvex();
  const { effort, webSearch, model, profile } = useConfigStore(
    useShallow((state) => ({
      model: state.model,
      effort: state.effort,
      webSearch: state.webSearch,
      profile: state.profile,
    })),
  );

  async function sendChatRequest() {
    const sessionId = id!;
    let threadId: Id<"threads"> | null = fromUUID<Id<"threads">>(params?.threadId) ?? null;
    const { input, attachments } = useChatStore.getState();
    const metadataModelParams = { effort, webSearch, profile: profile ?? null };

    const messageState = useMessageStore.getState();

    const messagesHistory = messageState.messageIds
      .map((id) => messageState.messagesById[id]!)
      .sort((a, b) => a.createdAt - b.createdAt);

    const lastMessage = messagesHistory[messagesHistory.length - 1];

    if (!input || lastMessage?.status === "pending" || lastMessage?.status === "streaming") return;
    chatStoreActions.resetInput();

    if (!threadId) {
      threadId = await convexClient.mutation(api.functions.threads.createThread, {
        sessionId,
        latestModel: model,
        latestModelParams: metadataModelParams,
      });

      await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(threadId) } });
    }

    const abortController = new AbortController();
    const streamId = crypto.randomUUID();
    let assistantMessageId: Id<"messages"> | null = null;

    const userMessage: CreateMessage = {
      messageId: crypto.randomUUID(),
      role: "user",
      status: "complete",
      parts: [{ type: "text", text: input, state: "done" }],
      attachments: [],
    };

    const assistantMessage: CreateMessage = {
      messageId: crypto.randomUUID(),
      role: "assistant",
      status: "pending",
      parts: [],
      attachments: [],
      metadata: {
        model: { request: model, response: null },
        finishReason: null,
        timeToFirstTokenMs: 0,
        usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
        durations: { request: 0, reasoning: 0, text: 0 },
        modelParams: metadataModelParams,
      },
    };

    assistantMessageId = await convexClient.mutation(api.functions.messages.addMessagesToThread, {
      sessionId,
      threadId,
      messages: [userMessage, assistantMessage],
    });

    // Sending a new message is explicit intent to follow the latest response.
    if (typeof window !== "undefined") {
      setStickyToBottom(true);
      window.dispatchEvent(new Event("chat:force-scroll-bottom"));
    }

    messageStoreActions.setController(threadId, {
      controller: abortController,
      assistantMessageId,
      streamId,
    });

    const messages = convertToUIChatMessages(messagesHistory);
    const uploadedAttachments = await uploadUserAttachment(attachments, threadId, sessionId);

    messages.push({
      role: "user",
      id: userMessage.messageId,
      parts: [{ type: "text", text: input }],
    });

    if (uploadedAttachments.length > 0) {
      const userMessageParts = messages[messages.length - 1]!.parts;
      const attachmentIds = uploadedAttachments.map((a) => a.attachmentId);

      for (const { path, mediaType } of uploadedAttachments) {
        const url = buildAttachmentUrl(path, mediaType);

        userMessageParts.push({ type: "file", url, mediaType });
      }

      await convexClient.mutation(api.functions.messages.addAttachmentsToMessage, {
        messageId: userMessage.messageId,
        parts: userMessageParts as ChatMessage["parts"],
        attachmentIds,
        sessionId,
      });
    }

    try {
      const body: ChatRequestBody = {
        model,
        threadId,
        streamId,
        messages,
        assistantMessageId,
        modelParams: metadataModelParams,
      };

      const response = await fetch(new URL("/api/ai/chat", import.meta.env.VITE_API_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      await throwIfChatResponseError(response);

      const responseStreamId = response.headers.get("X-Stream-Id") ?? streamId;
      if (responseStreamId) {
        messageStoreActions.setController(threadId, {
          controller: abortController,
          assistantMessageId,
          streamId: responseStreamId,
        });
      }

      await processStreamResponse(response, assistantMessageId, threadId);
    } catch (error) {
      if (isAbortError(error)) return;

      const errorMessage = getClientErrorMessage(error);
      const deprecatedModelError = getDeprecatedModelError(error);

      if (assistantMessageId) {
        const [, updateError] = await tryCatch(
          convexClient.mutation(api.functions.messages.updateErrorMessage, {
            sessionId,
            messageId: assistantMessageId,
            error: errorMessage,
            metadata: {
              model: { request: model, response: null },
              modelParams: metadataModelParams,
            },
          }),
        );

        if (updateError) {
          console.error("[Chat] Failed to persist request error", updateError);
        }
      }

      if (deprecatedModelError) {
        toast.error("Selected model is deprecated", {
          description: deprecatedModelError.message,
          action: {
            label: `Switch to ${deprecatedModelError.replacementModelName}`,
            onClick: () => {
              configStore.setConfig({
                model: deprecatedModelError.replacementModelId,
                defaultModel: deprecatedModelError.replacementModelId,
              });
            },
          },
        });
        return;
      }

      toast.error("Failed to send message", { description: errorMessage });
    } finally {
      messageStoreActions.removeController(threadId);
    }
  }

  return { sendChatRequest };
}
