import { describe, expect, test } from "bun:test";

import {
  hasMessageContent,
  splitMessageTokens,
  toPlainMessageText,
} from "@ai-chat/shared/chat/message-content";
import { fromText, toLabel, toText } from "@ui-sdk/react/token-input";

import { isToken } from "./composer-tokens";

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

describe("splitMessageTokens", function () {
  test("finds the same chips as the composer's codec, whatever the escaping", function () {
    const pieces = ["\\", "[@", "]", "(", ")", "](file:x)", "a", " ", "\n"];
    const tokens = [
      { type: "file", value: "a(1)", label: "x [y] \\z" },
      { type: "name", value: "", label: "[@n](file:m)" },
    ];
    let seed = 7;
    const random = (max: number) => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed % max;
    };

    for (let run = 0; run < 2000; run++) {
      const value = Array.from({ length: 1 + random(6) }, () =>
        random(3) === 0
          ? tokens[random(tokens.length)]!
          : Array.from({ length: 1 + random(5) }, () => pieces[random(pieces.length)]).join(""),
      );
      const text = toText(value);
      const expected = fromText(text).flatMap((segment) =>
        isToken(segment) ? [{ type: segment.type, value: segment.value, label: segment.label }] : [],
      );
      const found = splitMessageTokens(text).flatMap((segment) =>
        segment.kind === "token" ? [{ type: segment.type, value: segment.value, label: segment.label }] : [],
      );

      expect(found).toEqual(expected);
      expect(toPlainMessageText(text)).toBe(toLabel(fromText(text)));
    }
  });

  test("reads a long run of backslashes quickly", function () {
    const text = `${"\\".repeat(200_000)}[@a.pdf](file:x)`;
    const started = performance.now();

    expect(splitMessageTokens(text).at(-1)).toMatchObject({ kind: "token", label: "a.pdf" });
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("the saved message format", function () {
  // Messages are stored in this format, so a ui-sdk upgrade that changes it must fail here.
  test("stays the same", function () {
    const value = [
      "Typed [@x](file:y) and \\",
      { type: "file", value: "a(1)", label: "q3 [final].pdf" },
      " then ",
      { type: "name", value: "", label: "notes.md" },
    ];
    const saved = "Typed \\[@x](file:y) and \\\\[@q3 \\[final\\].pdf](file:a\\(1\\)) then [@notes.md](name:)";

    expect(toText(value)).toBe(saved);
    expect(splitMessageTokens(saved)).toEqual([
      { kind: "text", text: "Typed \\[@x](file:y) and \\\\", plain: "Typed [@x](file:y) and \\" },
      { kind: "token", type: "file", value: "a(1)", label: "q3 [final].pdf" },
      { kind: "text", text: " then ", plain: " then " },
      { kind: "token", type: "name", value: "", label: "notes.md" },
    ]);
  });
});
