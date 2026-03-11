import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";

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

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const pending: UIMessageChunk[] = [];

  let buffer = "";
  let streamDone = false;

  function findBoundaryIndex(input: string): { index: number; length: number } | null {
    const lf = input.indexOf("\n\n");
    const crlf = input.indexOf("\r\n\r\n");

    if (lf === -1 && crlf === -1) return null;
    if (lf === -1) return { index: crlf, length: 4 };
    if (crlf === -1) return { index: lf, length: 2 };
    return lf < crlf ? { index: lf, length: 2 } : { index: crlf, length: 4 };
  }

  function extractData(eventBlock: string): string | null {
    let data: string | null = null;

    let lineStart = 0;
    for (let i = 0; i <= eventBlock.length; i++) {
      const isEnd = i === eventBlock.length;
      const isLf = !isEnd && eventBlock.charCodeAt(i) === 10;

      if (!isEnd && !isLf) continue;

      let lineEnd = i;
      if (lineEnd > lineStart && eventBlock.charCodeAt(lineEnd - 1) === 13) {
        lineEnd--;
      }

      const line = eventBlock.slice(lineStart, lineEnd);
      lineStart = i + 1;

      if (!line.startsWith("data:")) continue;

      let value = line.slice(5);
      if (value.startsWith(" ")) value = value.slice(1);

      if (data == null) data = value;
      else data += `\n${value}`;
    }

    return data;
  }

  function parseBuffer(): void {
    while (true) {
      const boundary = findBoundaryIndex(buffer);
      if (boundary == null) return;

      const eventBlock = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary.length);

      const data = extractData(eventBlock);
      if (data == null) continue;

      if (data === "[DONE]") {
        streamDone = true;
        return;
      }

      const parsed = JSON.parse(data) as unknown;

      if (
        typeof parsed === "object" &&
        parsed != null &&
        "type" in parsed &&
        typeof (parsed as any).type === "string"
      ) {
        const chunk = parsed as UIMessageChunk;
        pending.push(chunk);
        options.onChunk?.(chunk);
      }
    }
  }

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

        if (pending.length > 0) {
          controller.enqueue(pending.shift() as UIMessageChunk);
          return;
        }

        while (pending.length === 0 && !streamDone) {
          const { value, done } = await reader.read();
          throwIfAborted();

          if (done) {
            buffer += decoder.decode();
            parseBuffer();
            streamDone = true;
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          parseBuffer();

          if (pending.length > 0) break;
        }

        if (pending.length > 0) {
          controller.enqueue(pending.shift() as UIMessageChunk);
          return;
        }

        await cancelUpstream();
        controller.close();
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
  const flushMode =
    options.flushMode ?? (typeof requestAnimationFrame === "function" ? "raf" : "timeout");
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

    const snapshot = { ...latestMessage } as UI_MESSAGE;
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

    if (flushMode === "raf" && typeof requestAnimationFrame === "function") {
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
    if (rafId != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
    }
  }

  function handleStreamError(error: unknown): void {
    emit({ type: "error", error });
  }

  try {
    const chunkStream = createUIMessageChunkStreamFromResponse({
      response: options.response,
      onChunk,
      signal: options.signal,
    });

    const uiMessageStream = readUIMessageStream({
      stream: chunkStream,
      message: options.message as UIMessage | undefined,
      onError: handleStreamError,
      terminateOnError: options.terminateOnError,
    }) as AsyncIterable<UI_MESSAGE>;

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
