import { describe, expect, test } from "bun:test";

import type { UIMessageChunk } from "ai";

import { batchMessageStream } from "./batch-message-stream";

const delta = (text: string): UIMessageChunk => ({ type: "text-delta", id: "t1", delta: text });

describe("batchMessageStream", () => {
  test("coalesces consecutive text deltas", async () => {
    const stream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue(delta("a"));
        controller.enqueue(delta("b"));
        controller.enqueue({ type: "text-end", id: "t1" });
        controller.close();
      },
    }).pipeThrough(batchMessageStream());

    expect(await Array.fromAsync(stream)).toEqual([
      { type: "text-delta", id: "t1", delta: "ab" },
      { type: "text-end", id: "t1" },
    ]);
  });

  test("drops buffered text without throwing when the reader cancels", async () => {
    const errors: Error[] = [];
    const onError = (error: Error) => errors.push(error);
    process.on("uncaughtException", onError);

    try {
      const transform = batchMessageStream();
      const reader = transform.readable.getReader();
      const writer = transform.writable.getWriter();
      void reader.read().catch(() => {});
      await writer.write(delta("pending"));
      await reader.cancel("client disconnected");
      await new Promise((resolve) => setTimeout(resolve, 80));
    } finally {
      process.off("uncaughtException", onError);
    }

    expect(errors).toEqual([]);
  });
});
