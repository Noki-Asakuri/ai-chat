/* oxlint-disable no-await-in-loop -- Stream parsing depends on each preceding read and buffer state. */
import {
  parseUIMessageChunkStream,
  readUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from "@ai-chat/shared/chat/ui";

export type UIMessageStreamEvent<UI_MESSAGE extends UIMessage = UIMessage> =
  | {
      type: "message";
      message: UI_MESSAGE;
      lastChunkType?: UIMessageChunk["type"];
    }
  | { type: "chunk"; chunk: UIMessageChunk }
  | { type: "error"; error: unknown }
  | { type: "done" };

export type ConsumeUIMessageStreamResponseOptions<UI_MESSAGE extends UIMessage = UIMessage> = {
  response: Response;

  /**
   * Pass this when resuming/continuing a previous assistant message.
   * This maps to readUIMessageStream({ message }).
   */
  message?: UI_MESSAGE;

  /**
   * Batched (message) events are emitted at most once per frame (default).
   * If emitChunks is enabled, chunk events are unbatched and can be high volume.
   */
  onEvent: (event: UIMessageStreamEvent<UI_MESSAGE>) => void;

  /**
   * If true, emits every parsed UIMessageChunk as { type: 'chunk' }.
   * Defaults to false to avoid flooding the main thread.
   */
  emitChunks?: boolean;

  /**
   * Default: 'raf' (best for React UIs).
   * Falls back to 'timeout' automatically if requestAnimationFrame is unavailable.
   */
  flushMode?: "raf" | "timeout";

  /**
   * Only used when flushMode === 'timeout' (or as a fallback).
   * Default: 16ms (~60fps).
   */
  flushIntervalMs?: number;

  signal?: AbortSignal;

  /**
   * Passed through to readUIMessageStream.
   * Defaults to false in the AI SDK.
   */
  terminateOnError?: boolean;
};

export function createUIMessageChunkStreamFromResponse(options: {
  response: Response;
  onChunk?: (chunk: UIMessageChunk) => void;
  signal?: AbortSignal;
}): ReadableStream<UIMessageChunk> {
  const body = options.response.body;
  if (body == null) {
    throw new Error("Response body is null (streaming not enabled / already consumed).");
  }

  const reader = parseUIMessageChunkStream(body).getReader();

  async function cancelUpstream(): Promise<void> {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  function throwIfAborted(): void {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
  }

  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      try {
        throwIfAborted();

        const { value, done } = await reader.read();
        throwIfAborted();

        if (done) {
          controller.close();
          return;
        }

        options.onChunk?.(value);
        controller.enqueue(value);
      } catch (error) {
        await cancelUpstream();
        controller.error(error);
      }
    },

    async cancel() {
      await cancelUpstream();
    },
  });
}

export async function consumeUIMessageStreamResponse<UI_MESSAGE extends UIMessage = UIMessage>(
  options: ConsumeUIMessageStreamResponseOptions<UI_MESSAGE>,
): Promise<void> {
  const flushMode = options.flushMode ?? ("requestAnimationFrame" in globalThis ? "raf" : "timeout");
  const flushIntervalMs = options.flushIntervalMs ?? 16;

  let latestMessage: UI_MESSAGE | undefined;
  let lastChunkType: UIMessageChunk["type"] | undefined;

  let flushScheduled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let rafId: number | undefined;

  function emit(event: UIMessageStreamEvent<UI_MESSAGE>): void {
    options.onEvent(event);
  }

  function onChunk(chunk: UIMessageChunk): void {
    lastChunkType = chunk.type;
    if (options.emitChunks === true) {
      emit({ type: "chunk", chunk });
    }
  }

  function flushMessage(): void {
    if (latestMessage == null) return;

    const snapshot = { ...latestMessage };
    latestMessage = undefined;

    emit({
      type: "message",
      message: snapshot,
      lastChunkType,
    });
  }

  function scheduleFlush(): void {
    if (flushScheduled) return;
    flushScheduled = true;

    if (flushMode === "raf" && "requestAnimationFrame" in globalThis) {
      rafId = requestAnimationFrame(function handleFrame() {
        flushScheduled = false;
        rafId = undefined;
        flushMessage();
      });
      return;
    }

    timeoutId = setTimeout(function handleTimeout() {
      flushScheduled = false;
      timeoutId = undefined;
      flushMessage();
    }, flushIntervalMs);
  }

  function cleanupTimers(): void {
    if (timeoutId != null) clearTimeout(timeoutId);
    if (rafId != null && "cancelAnimationFrame" in globalThis) {
      cancelAnimationFrame(rafId);
    }
  }

  function handleStreamError(cause: unknown): void {
    emit({ type: "error", error: cause });
  }

  try {
    const chunkStream = createUIMessageChunkStreamFromResponse({
      response: options.response,
      onChunk,
      signal: options.signal,
    });

    const uiMessageStream = readUIMessageStream({
      stream: chunkStream,
      message: options.message,
      onError: handleStreamError,
      terminateOnError: options.terminateOnError,
    });

    for await (const uiMessage of uiMessageStream) {
      if (options.signal?.aborted) break;

      latestMessage = uiMessage;
      scheduleFlush();
    }

    cleanupTimers();
    flushMessage();
    emit({ type: "done" });
  } catch (error) {
    cleanupTimers();
    emit({ type: "error", error });
    throw error;
  }
}
