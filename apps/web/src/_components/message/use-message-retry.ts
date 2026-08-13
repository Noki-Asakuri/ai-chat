import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { hasMessageContent } from "@ai-chat/shared/chat/message-content";
import * as React from "react";
import { useShallow } from "zustand/shallow";

import {
  useRetryTurn,
  type RetryTurnOptions,
} from "@/lib/chat/server-function/retry-turn";
import { useMessageStore } from "@/lib/store/messages-store";

type RetryOverrides = Omit<
  RetryTurnOptions,
  "assistantMessageId" | "mode" | "onPrepared" | "userMessageId"
>;

type UseMessageRetryOptions = {
  userMessageId: Id<"messages"> | null;
  assistantMessageId?: Id<"messages">;
};

export function useMessageRetry({
  userMessageId,
  assistantMessageId,
}: UseMessageRetryOptions) {
  const { retryTurn } = useRetryTurn();
  const [confirmation, setConfirmation] = React.useState<RetryOverrides | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const retryState = useMessageStore(useShallow((state) => {
    if (!userMessageId) {
      return { assistantMessage: null, isStreaming: false };
    }

    const userMessage = state.messagesById[userMessageId];
    const threadId = userMessage?.threadId;
    const controller = threadId ? state.controllers[threadId] : undefined;
    const thread = threadId ? state.threadsById[threadId] : undefined;
    const lastMessageId = thread?.messageIds[thread.messageIds.length - 1];
    const lastMessageStatus = lastMessageId ? thread?.messagesById[lastMessageId]?.status : undefined;
    const resolvedAssistantMessageId =
      assistantMessageId ??
      state.activeAssistantMessageIdByUserMessageId[userMessageId] ??
      state.variantMessageIdsByUserMessageId[userMessageId]?.at(-1);
    const assistantMessage = resolvedAssistantMessageId
      ? state.messagesById[resolvedAssistantMessageId]
      : undefined;

    return {
      assistantMessage:
        assistantMessage?.role === "assistant" ? assistantMessage : null,
      isStreaming:
        controller !== undefined ||
        lastMessageStatus === "pending" ||
        lastMessageStatus === "streaming",
    };
  }));

  const pending = isPending || retryState.isStreaming;

  function executeRetry(
    overrides: RetryOverrides,
    mode: "createVariant" | "replace",
  ): void {
    if (!userMessageId || pending) return;

    setConfirmation(null);

    startTransition(async () => {
      await retryTurn({
        userMessageId,
        assistantMessageId: retryState.assistantMessage?._id,
        mode,
        ...overrides,
      });
    });
  }

  function requestRetry(overrides: RetryOverrides = {}): void {
    if (!userMessageId || pending) return;

    const assistantMessage = retryState.assistantMessage;
    const shouldConfirm =
      assistantMessage?.metadata?.finishReason === "aborted" &&
      hasMessageContent(assistantMessage.parts, assistantMessage.attachments.length);

    if (shouldConfirm) {
      setConfirmation(overrides);
      return;
    }

    executeRetry(overrides, "createVariant");
  }

  return {
    assistantMessage: retryState.assistantMessage,
    confirmationOpen: confirmation !== null,
    isPending: pending,
    requestRetry,
    setConfirmationOpen(open: boolean): void {
      if (!open) setConfirmation(null);
    },
    createVariant(): void {
      if (!confirmation) return;
      executeRetry(confirmation, "createVariant");
    },
    replaceResponse(): void {
      if (!confirmation) return;
      executeRetry(confirmation, "replace");
    },
  };
}
