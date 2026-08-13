import { describe, expect, test } from "bun:test";

import { hasMessageContent } from "@ai-chat/shared/chat/message-content";

describe("hasMessageContent", function () {
  test("treats an empty response as having no content", function () {
    expect(hasMessageContent([], 0)).toBe(false);
    expect(hasMessageContent([{ type: "step-start" }], 0)).toBe(false);
    expect(hasMessageContent([{ type: "text", text: "   " }], 0)).toBe(false);
  });

  test("detects visible and generated response content", function () {
    expect(hasMessageContent([{ type: "text", text: "Response" }], 0)).toBe(true);
    expect(hasMessageContent([{ type: "reasoning", text: "Thought" }], 0)).toBe(true);
    expect(hasMessageContent([{ type: "dynamic-tool" }], 0)).toBe(true);
    expect(hasMessageContent([], 1)).toBe(true);
  });
});
