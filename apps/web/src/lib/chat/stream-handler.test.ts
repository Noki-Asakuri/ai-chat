import { describe, expect, test } from "bun:test";

import { createUIMessageChunkStreamFromResponse } from "./stream-handler";

describe("createUIMessageChunkStreamFromResponse", function () {
  test("emits valid chunks and skips invalid events", async function () {
    const response = new Response(
      [
        'data: {"type":"text-start","id":"text-1"}\n\n',
        'data: {"type":"unknown"}\n\n',
        "data: not-json\n\n",
        'data: {"type":"text-delta","id":"text-1","delta":"hello"}\n\n',
        "data: [DONE]\n\n",
      ].join(""),
    );
    const chunks = [];

    for await (const chunk of createUIMessageChunkStreamFromResponse({ response })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "hello" },
    ]);
  });
});
