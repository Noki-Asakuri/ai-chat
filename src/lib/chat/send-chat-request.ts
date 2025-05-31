import { processChatStream } from "./process-stream";

import type { ChatRequest } from "../types";
import { chatStore } from "./store";

export async function sendChatRequest(body: ChatRequest) {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });

  let reasoning = "";
  let content = "";

  await processChatStream(res.body!, async (stream) => {
    switch (stream.type) {
      case "text-delta":
        content += stream.data.replaceAll("\\n", "\n");
        break;

      case "reasoning":
        reasoning += stream.data.replaceAll("\\n", "\n");
        break;

      case "custom-json":
        console.log(stream.data);
        break;

      case "finish":
        chatStore.getState().setStatus("complete");
        break;
    }

    chatStore.getState().setAssistantMessage({ id: body.assistantMessageId, content, reasoning });
  });
}
