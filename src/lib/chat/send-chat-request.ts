import { processChatStream } from "./process-stream";
import { chatStore } from "./store";

export async function sendChatRequest(url: string | URL, init: RequestInit | undefined, assistantMessageId: string) {
  const state = chatStore.getState();
  state.setIsStreaming(true);

  let abortController = state.abortController;
  if (abortController.signal.aborted) {
    abortController = new AbortController();
    state.setAbortController(abortController);
  }

  state.setIsStreaming(true);
  try {
    let content = "";
    let reasoning = "";

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
            state.setStatus("complete");
            break;
        }

        state.setAssistantMessage({ id: assistantMessageId, content, reasoning });
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.debug("[Chat] Chat request aborted:", error.message);
      return;
    }

    console.error(Error(error as string));
  } finally {
    state.setIsStreaming(false);
  }
}
