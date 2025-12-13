// src/create-stream-response-handler.ts
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";

import type { UIChatMessage } from "../types";

export type StreamResponseHandlerOptions = {
  signal?: AbortSignal;
  resumeFrom?: UIChatMessage;
  terminateOnError?: boolean;
  onMessage?: (message: UIChatMessage) => void;
  onError?: (error: unknown) => void;
};

export function createStreamResponseHandler(
  response: Response,
  options: StreamResponseHandlerOptions = {},
): AsyncIterable<UIChatMessage> {
  assertUIMessageStreamResponse(response);

  const chunkStream = createChunkStream(response, options.signal);
  const iterable = readUIMessageStream<UIChatMessage>({
    stream: chunkStream,
    message: options.resumeFrom,
    onError: options.onError,
    terminateOnError: options.terminateOnError ?? false,
  });

  wireMessageForwarding(iterable, options.onMessage, options.onError);

  return iterable;
}

function assertUIMessageStreamResponse(response: Response): void {
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error(`Expected text/event-stream but received ${contentType}.`);
  }
}

function createChunkStream(
  response: Response,
  signal?: AbortSignal,
): ReadableStream<UIMessageChunk> {
  if (!response.body) {
    throw new Error("Response body is not readable.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let abortHandler: (() => void) | undefined;

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      if (signal) {
        abortHandler = function () {
          controller.error(signal.reason ?? new DOMException("Aborted", "AbortError"));
          reader.cancel(signal.reason).catch(() => undefined);
        };
        if (signal.aborted) {
          abortHandler();
          return;
        }
        signal.addEventListener("abort", abortHandler, { once: true });
      }
    },
    async pull(controller) {
      const result = await reader.read();
      if (result.done) {
        flushBuffer(controller);
        cleanup(signal);
        controller.close();
        return;
      }
      buffer += decoder.decode(result.value, { stream: true });
      emitChunks(controller);
    },
    cancel(reason) {
      cleanup(signal);
      reader.cancel(reason).catch(() => undefined);
    },
  });

  function emitChunks(controller: ReadableStreamDefaultController<UIMessageChunk>): void {
    let delimiterIndex = buffer.indexOf("\n\n");
    while (delimiterIndex !== -1) {
      const rawEvent = buffer.slice(0, delimiterIndex);
      buffer = buffer.slice(delimiterIndex + 2);
      const chunk = parseSSEBlock(rawEvent);
      if (chunk) {
        controller.enqueue(chunk);
      }
      delimiterIndex = buffer.indexOf("\n\n");
    }
  }

  function flushBuffer(controller: ReadableStreamDefaultController<UIMessageChunk>): void {
    if (!buffer.trim()) {
      return;
    }
    const chunk = parseSSEBlock(buffer);
    buffer = "";
    if (chunk) {
      controller.enqueue(chunk);
    }
  }

  function cleanup(activeSignal?: AbortSignal): void {
    if (abortHandler && activeSignal) {
      activeSignal.removeEventListener("abort", abortHandler);
      abortHandler = undefined;
    }
  }
}

function parseSSEBlock(block: string): UIMessageChunk | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  const lines = trimmed.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const payload = dataLines.join("\n").trim();
  if (!payload || payload === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(payload) as UIMessageChunk;
  } catch (error) {
    throw new Error(`Failed to parse UIMessageChunk: ${(error as Error).message}`);
  }
}

function wireMessageForwarding(
  iterable: AsyncIterable<UIChatMessage>,
  onMessage: ((message: UIChatMessage) => void) | undefined,
  onError: ((error: unknown) => void) | undefined,
): void {
  if (!onMessage) {
    return;
  }
  async function forward(): Promise<void> {
    for await (const message of iterable) {
      onMessage?.(message);
    }
  }

  forward().catch((error) => {
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
  });
}
