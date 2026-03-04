import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex } from "convex/react";
import { toast } from "sonner";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";

import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage, ChatRequestBody } from "@/lib/types";
import { tryCatch } from "@/lib/utils";

import { convertToUIChatMessages, processStreamResponse } from "../shared";
import {
  getClientErrorMessage,
  getDeprecatedModelError,
  isAbortError,
  throwIfChatResponseError,
} from "./chat-errors";

type RetryChatMessage = {
  userMessageId: Id<"messages">;

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
  const configProfile = useConfigStore((state) => state.profile);
  const configStore = useConfigStoreState();

  async function retryChatMessage({ userMessageId, ...options }: RetryChatMessage) {
    const sessionId = id!;
    const messageState = useMessageStore.getState();

    const threadId = messageState.currentThreadId;
    if (!threadId) return;

    const messagesHistory = messageState.messageIds
      .map((id) => messageState.messagesById[id]!)
      .sort((a, b) => a.createdAt - b.createdAt);

    const userMessageIndex = messagesHistory.findIndex((message) => message._id === userMessageId);
    if (userMessageIndex < 0) return;

    const userMessage = messagesHistory[userMessageIndex];
    if (!userMessage || userMessage.role !== "user") return;

    const activeAssistantMessageId =
      messageState.activeAssistantMessageIdByUserMessageId[userMessageId] ??
      messageState.variantMessageIdsByUserMessageId[userMessageId]?.at(-1);

    if (!activeAssistantMessageId) return;

    const assistantMessage = messageState.messagesById[activeAssistantMessageId];
    if (!assistantMessage || assistantMessage.role !== "assistant") return;

    const assistantMessageId = assistantMessage._id;
    let errorTargetMessageId = assistantMessageId;

    const abortController = new AbortController();
    const streamId = crypto.randomUUID();
    messageStoreActions.setController(threadId, {
      controller: abortController,
      assistantMessageId,
      streamId,
    });

    const historySlice = messagesHistory.slice(0, userMessageIndex + 1);

    if (options.userMessage) {
      const message = historySlice[userMessageIndex]!;
      historySlice[userMessageIndex] = { ...message, parts: options.userMessage.parts };
    }

    const allMessages = convertToUIChatMessages(historySlice);

    const model = options.modelId ?? assistantMessage.metadata!.model.request;
    const mergedModelParams = {
      ...assistantMessage.metadata!.modelParams,
      ...options.modelParams,
    };

    const mutationModelParams = {
      ...mergedModelParams,
      profile: configProfile === null ? null : (configProfile ?? mergedModelParams.profile ?? null),
    };

    try {
      const retryResult = await convexClient.mutation(api.functions.messages.retryChatMessage, {
        sessionId,
        threadId,
        assistantMessageId,

        model,
        modelParams: mutationModelParams,
        userMessage: options.userMessage,
      });

      const nextAssistantMessageId = retryResult.assistantMessageId;
      errorTargetMessageId = nextAssistantMessageId;

      messageStoreActions.setController(threadId, {
        controller: abortController,
        assistantMessageId: nextAssistantMessageId,
        streamId,
      });

      // Only scroll down when the message has updated (only if user is already at bottom)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("chat:scroll-if-sticky"));
      }

      const body: ChatRequestBody = {
        model,
        threadId,
        streamId,
        messages: allMessages,
        assistantMessageId: nextAssistantMessageId,
        modelParams: mutationModelParams,
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
          assistantMessageId: nextAssistantMessageId,
          streamId: responseStreamId,
        });
      }

      await processStreamResponse(response, nextAssistantMessageId, threadId);
    } catch (error) {
      if (isAbortError(error)) return;

      const errorMessage = getClientErrorMessage(error);
      const deprecatedModelError = getDeprecatedModelError(error);

      const [, updateError] = await tryCatch(
        convexClient.mutation(api.functions.messages.updateErrorMessage, {
          sessionId,
          messageId: errorTargetMessageId,
          error: errorMessage,
          metadata: {
            model: { request: model, response: null },
            modelParams: mutationModelParams,
          },
        }),
      );

      if (updateError) {
        console.error("[Chat] Failed to persist retry error", updateError);
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

      toast.error("Failed to retry message", { description: errorMessage });
    } finally {
      messageStoreActions.removeController(threadId);
    }
  }

  return { retryChatMessage };
}
