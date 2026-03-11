import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";

type AbortChatStreamRequestBody = {
  streamId: string;
  threadId: Id<"threads">;
  assistantMessageId: Id<"messages">;
  parts: unknown;
  metadata?: unknown;
};

export function useAbortChatStream() {
  async function abortChatStream(threadId: Id<"threads">): Promise<void> {
    const state = useMessageStore.getState();
    const controllerEntry = state.controllers[threadId];

    if (!controllerEntry) return;

    const abortController = controllerEntry.controller;
    const assistantMessageId = controllerEntry.assistantMessageId;
    const streamId = controllerEntry.streamId;

    // Stop client-side consumption immediately.
    if (!abortController.signal.aborted) {
      abortController.abort("User aborted");
    }

    // Best-effort cleanup if we don't have enough context to notify the server.
    if (!assistantMessageId || !streamId) {
      messageStoreActions.removeController(threadId);
      return;
    }

    // Immediately reflect terminal abort state in the UI and normalize part.state=done.
    messageStoreActions.markMessageAborted(threadId, assistantMessageId);

    const nextState = useMessageStore.getState();
    const thread = nextState.threadsById[threadId];
    const message =
      thread?.messagesById[assistantMessageId] ?? nextState.messagesById[assistantMessageId];

    const body: AbortChatStreamRequestBody = {
      streamId,
      threadId,
      assistantMessageId,
      parts: message?.parts ?? [],
      ...(message?.metadata ? { metadata: message.metadata } : {}),
    };

    try {
      // Tell server to stop generating, and persist partial output.
      // Intentionally not using the abortController.signal: this request should go through even if the UI stream was aborted.
      await fetch(new URL("/api/ai/chat/abort", import.meta.env.VITE_API_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      messageStoreActions.removeController(threadId);
    }
  }

  return { abortChatStream };
}
