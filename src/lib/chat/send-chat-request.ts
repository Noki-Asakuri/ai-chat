import { processChatStream } from "./process-stream";

import type { ChatRequest } from "../types";
import { chatStore } from "./store";

export async function sendChatRequest(body: ChatRequest) {
  const state = chatStore.getState();
  state.setIsStreaming(true);

  let abortController = state.abortController;

  if (abortController.signal.aborted) {
    abortController = new AbortController();
    state.setAbortController(abortController);
  }

  body.config = state.chatConfig;

  try {
    const res = fetch("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    let reasoning = "";
    let content = "";

    await processChatStream(res, async (stream) => {
      switch (stream.type) {
        case "text-delta":
          content += stream.data;
          break;

        case "reasoning":
          reasoning += stream.data;
          break;

        case "custom-json":
          console.log(stream.data);
          break;

        case "finish":
          state.setStatus("complete");
          break;
      }

      state.setAssistantMessage({ id: body.assistantMessageId, content, reasoning });
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.debug("[Chat] Chat request aborted:", error.message);
      return;
    }

    console.error(Error(error as string));
  }

  state.setIsStreaming(false);
}
