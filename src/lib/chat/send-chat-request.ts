import { processChatStream } from "./process-stream";

import type { ChatRequest } from "../types";
import { chatStore } from "./store";

export async function sendChatRequest(body: ChatRequest) {
  const state = chatStore.getState();
  state.setLocalStreaming(true);

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });

  let reasoning = "";
  let content = "";

  await processChatStream(res.body!, async (stream) => {
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
        chatStore.getState().setStatus("complete");
        break;
    }

    state.setAssistantMessage({ id: body.assistantMessageId, content, reasoning });
  });

  state.setLocalStreaming(false);
}
