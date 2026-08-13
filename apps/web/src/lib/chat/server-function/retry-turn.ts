import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useConvex } from "convex/react";
import { toast } from "@/components/ui/toast";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";

import { setStickyToBottom } from "@/lib/chat/scroll-stickiness";
import { emitStreamFeedback } from "@/lib/chat/stream-feedback";
import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import { chatStoreActions } from "@/lib/store/chat-store";
import type { ChatMessage, ChatRequestBody } from "@/lib/types";
import { tryCatch } from "@/lib/utils";

import { convertToUIChatMessages, processStreamResponse } from "../shared";
import {
  getClientErrorMessage,
  getDeprecatedModelError,
  isAbortError,
  throwIfChatResponseError,
} from "./chat-errors";

export type RetryTurnOptions = {
  mode?: "createVariant" | "replace";
  userMessageId: Id<"messages">;
  assistantMessageId?: Id<"messages">;

  modelId?: string;
  modelParams?: Partial<NonNullable<ChatMessage["metadata"]>["modelParams"]>;

  userMessage?: {
    messageId: Id<"messages">;
    parts: ChatMessage["parts"];
    attachments: Id<"attachments">[];
  };
  onPrepared?: () => void;
};

export type RetryTurnResult =
  { status: "started" } | { status: "failed"; phase: "preparation" | "stream" } | { status: "ignored" };

const RETRY_PREPARATION_POLL_MS = 250;

function waitForRetryPreparationPoll(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, RETRY_PREPARATION_POLL_MS));
}

export function useRetryTurn() {
  const convexClient = useConvex();

  const configStore = useConfigStoreState();
  const { model, modelParams, notificationSound, desktopNotification } = useConfigStore(
    useShallow((state) => ({
      model: state.model,
      modelParams: state.modelParams,
      notificationSound: state.notificationSound,
      desktopNotification: state.desktopNotification,
    })),
  );

  async function retryTurn({
    mode = "createVariant",
    userMessageId,
    assistantMessageId: retryAssistantMessageId,
    onPrepared,
    ...options
  }: RetryTurnOptions): Promise<RetryTurnResult> {
    const messageState = useMessageStore.getState();
    const userMessage = messageState.messagesById[userMessageId];
    if (!userMessage || userMessage.role !== "user") {
      toast.error("Unable to retry message", { description: "The user message is no longer available." });
      return { status: "failed", phase: "preparation" };
    }

    const threadId = userMessage.threadId;
    const threadState = messageState.threadsById[threadId];
    if (!threadState) {
      toast.error("Unable to retry message", { description: "The thread is not loaded." });
      return { status: "failed", phase: "preparation" };
    }

    const messagesHistory = threadState.messageIds
      .map((id) => threadState.messagesById[id])
      .filter((message): message is ChatMessage => message !== undefined)
      .sort((a, b) => a.createdAt - b.createdAt);

    const userMessageIndex = messagesHistory.findIndex((message) => message._id === userMessageId);
    if (userMessageIndex < 0) {
      toast.error("Unable to retry message", { description: "The user turn is not in the loaded history." });
      return { status: "failed", phase: "preparation" };
    }

    const activeAssistantMessageId =
      retryAssistantMessageId ??
      threadState.activeAssistantMessageIdByUserMessageId[userMessageId] ??
      threadState.variantMessageIdsByUserMessageId[userMessageId]?.at(-1);
    const assistantMessage = activeAssistantMessageId
      ? threadState.messagesById[activeAssistantMessageId]
      : undefined;
    if (assistantMessage && assistantMessage.role !== "assistant") {
      toast.error("Unable to retry message", { description: "The selected response is invalid." });
      return { status: "failed", phase: "preparation" };
    }

    const historySlice = messagesHistory.slice(0, userMessageIndex + 1);

    if (options.userMessage) {
      const message = historySlice[userMessageIndex]!;
      historySlice[userMessageIndex] = { ...message, parts: options.userMessage.parts };
    }

    const allMessages = convertToUIChatMessages(historySlice);

    const requestModel = options.modelId ?? assistantMessage?.metadata?.model.request ?? model;
    const mergedModelParams = {
      ...(assistantMessage?.metadata?.modelParams ?? configStore.modelParams),
      webSearch: modelParams.webSearch,
      ...options.modelParams,
    };

    const mutationModelParams = {
      ...mergedModelParams,
      profile:
        modelParams.profile === null ? null : (modelParams.profile ?? mergedModelParams.profile ?? null),
    };

    const retryMetadata = {
      durations: { request: 0, reasoning: 0, text: 0 },
      usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
      timeToFirstTokenMs: 0,
      finishReason: null,
      modelParams: mutationModelParams,
      model: { request: requestModel, response: null },
    };
    let preparedAssistantMessageId: Id<"messages"> | null = null;
    let retryAttemptId: Id<"retryAttempts"> | null = null;
    let abortController: AbortController | null = null;
    let streamStarted = false;
    let prepared = false;
    const operationId = crypto.randomUUID();

    if (!messageStoreActions.startRetryOperation(threadId, operationId)) {
      return { status: "ignored" };
    }

    try {
      const initialRetryResult = await convexClient.mutation(api.functions.messages.prepareRetryTurn, {
        threadId,
        userMessageId,
        assistantMessageId: assistantMessage?._id,
        mode,

        model: requestModel,
        modelParams: mutationModelParams,
        userMessage: options.userMessage,
      });

      retryAttemptId = initialRetryResult.retryAttemptId;
      let retryResult;
      if (initialRetryResult.status === "prepared") {
        retryResult = initialRetryResult;
      } else {
        let preparationStatus = await convexClient.query(api.functions.messages.getRetryAttempt, {
          retryAttemptId: initialRetryResult.retryAttemptId,
        });

        while (preparationStatus.status === "preparing") {
          await waitForRetryPreparationPoll();
          preparationStatus = await convexClient.query(api.functions.messages.getRetryAttempt, {
            retryAttemptId: initialRetryResult.retryAttemptId,
          });
        }

        if (preparationStatus.status === "failed") throw new Error(preparationStatus.error);
        if (preparationStatus.status === "cancelled") throw new Error("Retry was cancelled");
        retryResult = preparationStatus;
      }

      const nextAssistantMessageId = retryResult.assistantMessageId;
      preparedAssistantMessageId = nextAssistantMessageId;
      messageStoreActions.prepareAssistantMessageForRetry(threadId, {
        assistantMessageId: nextAssistantMessageId,
        userMessageId: retryResult.userMessageId,
        creationTime: retryResult.creationTime,
        messageId: retryResult.messageId,
        userId: retryResult.userId,
        createdAt: retryResult.createdAt,
        variantIndex: retryResult.variantIndex,
        metadata: retryMetadata,
      });
      prepared = true;
      onPrepared?.();

      abortController = new AbortController();

      messageStoreActions.setController(threadId, {
        controller: abortController,
        assistantMessageId: nextAssistantMessageId,
      });

      // Retrying is explicit intent to follow the latest response.
      if (typeof window !== "undefined") {
        setStickyToBottom(true);
        window.dispatchEvent(new Event("chat:force-scroll-bottom"));
      }

      const body: ChatRequestBody = {
        model: requestModel,
        threadId,
        messages: allMessages,
        assistantMessageId: nextAssistantMessageId,
        retryAttemptId: retryResult.retryAttemptId,
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

      const responseStreamId = response.headers.get("X-Stream-Id");
      if (!responseStreamId) throw new Error("The server did not return a resumable stream ID");

      streamStarted = true;
      messageStoreActions.setController(threadId, {
        controller: abortController,
        assistantMessageId: nextAssistantMessageId,
        streamId: responseStreamId,
      });

      await processStreamResponse(response, nextAssistantMessageId, threadId, abortController);
      emitStreamFeedback({
        status: "success",
        threadId,
        soundEnabled: notificationSound,
        desktopEnabled: desktopNotification,
      });
      return { status: "started" };
    } catch (error) {
      if (isAbortError(error)) {
        if (retryAttemptId && !streamStarted) {
          await tryCatch(
            convexClient.mutation(api.functions.messages.cancelRetryAttempt, {
              retryAttemptId,
              reason: "Retry cancelled before generation started",
            }),
          );
        }
        return { status: "failed", phase: prepared ? "stream" : "preparation" };
      }

      const errorMessage = getClientErrorMessage(error);
      const deprecatedModelError = getDeprecatedModelError(error);

      emitStreamFeedback({
        status: "error",
        threadId,
        soundEnabled: notificationSound,
        desktopEnabled: desktopNotification,
        errorMessage,
      });

      if (preparedAssistantMessageId) {
        const [, updateError] = await tryCatch(
          convexClient.mutation(api.functions.messages.updateErrorMessage, {
            messageId: preparedAssistantMessageId,
            error: errorMessage,
            retryAttemptId: retryAttemptId ?? undefined,
            metadata: {
              model: { request: requestModel, response: null },
              modelParams: mutationModelParams,
            },
          }),
        );

        if (updateError) {
          console.error("[Chat] Failed to persist retry error", updateError);
        }
      }

      if (deprecatedModelError) {
        toast.error("Selected model is deprecated", {
          description: deprecatedModelError.message,
          actionProps: {
            children: `Switch to ${deprecatedModelError.replacementModelName}`,
            onClick: () => {
              chatStoreActions.retainCompatibleAttachments(deprecatedModelError.replacementModelId);
              configStore.setConfig({
                model: deprecatedModelError.replacementModelId,
                defaultModel: deprecatedModelError.replacementModelId,
              });
            },
          },
        });
        return {
          status: "failed",
          phase: prepared ? "stream" : "preparation",
        };
      }

      toast.error("Failed to retry message", { description: errorMessage });
      return { status: "failed", phase: prepared ? "stream" : "preparation" };
    } finally {
      if (retryAttemptId && !preparedAssistantMessageId) {
        await tryCatch(
          convexClient.mutation(api.functions.messages.cancelRetryAttempt, {
            retryAttemptId,
            reason: "Retry preparation failed",
          }),
        );
      }
      if (abortController) messageStoreActions.removeController(threadId, abortController);
      messageStoreActions.finishRetryOperation(threadId, operationId);
    }
  }

  return { retryTurn };
}
