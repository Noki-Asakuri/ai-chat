import { processChatStream } from "./process-stream";

import type { ChatRequest } from "../types";
import { chatStore } from "./store";

export async function sendChatRequest(body: ChatRequest) {
  const state = chatStore.getState();
  state.setIsStreaming(true);

  // Not working yet
  // if (!state.abortController || state.abortController.signal.aborted) {
  //   console.debug("[Chat] Creating new abort signal", state.abortController);
  //   state.setAbortController(new AbortController());
  // }

  body.config = state.chatConfig;
  const res = fetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
    signal: state.abortController?.signal,
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
  state.setIsStreaming(false);
}
