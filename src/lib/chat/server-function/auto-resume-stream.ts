import type { Id } from "@/convex/_generated/dataModel";

import { useParams } from "@tanstack/react-router";

import { processStreamResponse } from "../shared";

import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import { fromUUID } from "@/lib/utils";

export function useAutoResumeStream() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId" });

  async function autoResumeStream(streamId: string, messageId: Id<"messages">) {
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

    const response = await fetch(
      new URL(`/api/ai/chat?streamId=${streamId}`, import.meta.env.VITE_API_ENDPOINT),
      { credentials: "include", signal: abortController.signal },
    );

    try {
      await processStreamResponse(response, messageId, threadId);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    } finally {
      messageStoreActions.removeController(threadId);
    }
  }

  return { autoResumeStream };
}
