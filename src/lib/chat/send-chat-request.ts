import { api } from "@/convex/_generated/api";

import { getConvexReactClient } from "../convex/client";
import type { ChatMessage } from "../types";

import { processChatStream } from "./process-stream";
import { chatStore } from "./store";
import type { Id } from "@/convex/_generated/dataModel";

const convexClient = getConvexReactClient();

export async function sendChatRequest(
  url: string | URL,
  init: RequestInit | undefined,
  assistantMessageId: Id<"messages">,
) {
  const state = chatStore.getState();

  state.setIsStreaming(true);
  state.setStatus("streaming");

  let abortController = state.abortController;
  if (abortController.signal.aborted) {
    abortController = new AbortController();
    state.setAbortController(abortController);
  }

  try {
    let content = "";
    let reasoning = "";
    let metadata: ChatMessage["metadata"] | undefined;

    await processChatStream({
      fetch: fetch(url, { ...init, signal: abortController.signal }),
      handler: async (stream) => {
        switch (stream.type) {
          case "text":
            content += stream.text;
            break;

          case "reasoning":
            reasoning += stream.text;
            break;

          case "finish":
            metadata = stream.metadata as ChatMessage["metadata"];
            state.setStatus("complete");
            break;
        }

        state.setAssistantMessage({ id: assistantMessageId, content, reasoning, metadata });
      },
    });
  } catch (error) {
    if (!(error instanceof Error)) {
      console.warn("[Chat] Error:", error);
      return;
    }
    if (error.name === "AbortError") return;

    const errorMessage = "Failed to generate response. Please try again later. \nError: " + error.message;
    console.log("[Chat] Chat error:", error);

    void convexClient.mutation(api.messages.updateErrorMessage, {
      messageId: assistantMessageId,
      error: errorMessage,
    });
  } finally {
    state.setIsStreaming(false);
  }
}
