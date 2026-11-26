import { describe, expect, test } from "bun:test";

import { hasMessageContent, toPlainMessageText } from "@ai-chat/shared/chat/message-content";
import { fromText, toLabel, toText } from "@ui-sdk/react/token-input";

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

describe("toPlainMessageText", function () {
  test("turns composer tokens into their labels and leaves other text alone", function () {
    expect(
      toPlainMessageText("Compare [@q3 \\[final\\].pdf](file:a1) with [docs](https://x.dev) and `code`"),
    ).toBe("Compare q3 [final].pdf with [docs](https://x.dev) and `code`");
  });

  test("reads escaped text as typed, the same as the composer's codec", function () {
    const chip = { type: "file", value: "a1", label: "a.pdf" };
    const values = [
      ["Explain [@home](file:example)"],
      ["See \\", { type: "upload", value: "u1", label: "[@draft](file:example).pdf" }],
      ["path\\", chip, " and \\\\[@x"],
      ["[@draft.pdf ", chip],
      ["a \\[@b](file:c) ", chip, " \\\\"],
    ];

    for (const value of values) {
      const text = toText(value);
      expect(toPlainMessageText(text)).toBe(toLabel(fromText(text)));
    }
    expect(toPlainMessageText(toText(["Explain [@home](file:example)"]))).toBe(
      "Explain [@home](file:example)",
    );
  });
});
