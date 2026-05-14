import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";

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

    try {
      // Tell server to stop generating.
      // Intentionally not using the abortController.signal: this request should go through even if the UI stream was aborted.
      await fetch(
        new URL(
          `/api/ai/chat/abort?streamId=${encodeURIComponent(streamId)}`,
          import.meta.env.VITE_API_ENDPOINT,
        ),
        { method: "POST", credentials: "include" },
      );
    } finally {
      messageStoreActions.removeController(threadId);
    }
  }

  return { abortChatStream };
}
