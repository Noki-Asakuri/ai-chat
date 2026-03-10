import type { Id } from "@/convex/_generated/dataModel";

import { useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

import { useConfigStore } from "@/components/provider/config-provider";

import { emitStreamFeedback } from "@/lib/chat/stream-feedback";
import { processStreamResponse } from "../shared";
import { getClientErrorMessage, isAbortError, throwIfChatResponseError } from "./chat-errors";

import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import { fromUUID } from "@/lib/utils";

export function useAutoResumeStream() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId" });
  const notificationSound = useConfigStore((state) => state.notificationSound);
  const desktopNotification = useConfigStore((state) => state.desktopNotification);

  const autoResumeStream = useCallback(
    async (streamId: string, messageId: Id<"messages">) => {
      const threadId = fromUUID<Id<"threads">>(params.threadId);

      const isAlreadyStreaming = useMessageStore.getState().controllers[threadId];
      if (isAlreadyStreaming) return;

      console.debug("[Chat] Resuming stream", streamId);

      const abortController = new AbortController();
      messageStoreActions.setController(threadId, {
        controller: abortController,
        assistantMessageId: messageId,
        streamId,
      });

      function cleanupController() {
        messageStoreActions.removeController(threadId);
      }

      try {
        const response = await fetch(
          new URL(`/api/ai/chat?streamId=${streamId}`, import.meta.env.VITE_API_ENDPOINT),
          { credentials: "include", signal: abortController.signal },
        );

        await throwIfChatResponseError(response);
        await processStreamResponse(response, messageId, threadId);
        emitStreamFeedback({
          status: "success",
          threadId,
          soundEnabled: notificationSound,
          desktopEnabled: desktopNotification,
        });
      } catch (error) {
        cleanupController();
        if (isAbortError(error)) return;

        emitStreamFeedback({
          status: "error",
          threadId,
          soundEnabled: notificationSound,
          desktopEnabled: desktopNotification,
          errorMessage: getClientErrorMessage(error),
        });

        toast.error("Failed to resume chat stream", {
          description: getClientErrorMessage(error),
        });

        return;
      }

      cleanupController();
    },
    [desktopNotification, notificationSound, params.threadId],
  );

  return { autoResumeStream };
}
