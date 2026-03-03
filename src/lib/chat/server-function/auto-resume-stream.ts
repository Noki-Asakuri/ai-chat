import type { Id } from "@/convex/_generated/dataModel";

import { useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

import { processStreamResponse } from "../shared";
import { getClientErrorMessage, isAbortError } from "./chat-errors";

import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import { fromUUID } from "@/lib/utils";

export function useAutoResumeStream() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId" });

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
        await processStreamResponse(response, messageId, threadId);
      } catch (error) {
        cleanupController();
        if (isAbortError(error)) return;

        toast.error("Failed to resume chat stream", {
          description: getClientErrorMessage(error),
        });

        return;
      }

      cleanupController();
    },
    [params.threadId],
  );

  return { autoResumeStream };
}
