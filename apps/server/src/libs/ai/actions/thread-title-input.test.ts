import { describe, expect, test } from "bun:test";

import { getThreadTitleInput } from "./thread-title-input";

const image = { type: "file", url: "https://example.com/a.png", mediaType: "image/png" };
const pdf = { type: "file", url: "https://example.com/a.pdf", mediaType: "application/pdf" };

describe("getThreadTitleInput", () => {
  test("summarizes typed text, with chips read as their labels", () => {
    expect(getThreadTitleInput([{ type: "text", text: "Describe [@photo.png](file:abc)" }, image])).toEqual({
      kind: "summarize",
      text: "Describe photo.png",
    });
  });

  test("names a message with no text after its files", () => {
    expect(getThreadTitleInput([image])).toEqual({ kind: "fixed", title: "Shared image" });
    expect(getThreadTitleInput([image, image])).toEqual({ kind: "fixed", title: "Shared images" });
    expect(getThreadTitleInput([image, pdf])).toEqual({ kind: "fixed", title: "Shared files" });
    expect(getThreadTitleInput([{ type: "text", text: "  " }, pdf])).toEqual({
      kind: "fixed",
      title: "Shared file",
    });
  });

  test("treats text made only of file chips as attachment-only", () => {
    expect(getThreadTitleInput([{ type: "text", text: "[@photo.png](file:abc)" }, image])).toEqual({
      kind: "fixed",
      title: "Shared image",
    });
    expect(
      getThreadTitleInput([{ type: "text", text: "[@a.png](file:a) [@b.pdf](file:b)" }, image, pdf]),
    ).toEqual({ kind: "fixed", title: "Shared files" });
  });

  test("counts a chip whose file the model could not read", () => {
    expect(getThreadTitleInput([{ type: "text", text: "[@report.pdf](file:abc)" }])).toEqual({
      kind: "fixed",
      title: "Shared file",
    });
  });

  test("falls back to the default title when there is nothing at all", () => {
    expect(getThreadTitleInput([])).toEqual({ kind: "fixed", title: "New Chat" });
  });
});
