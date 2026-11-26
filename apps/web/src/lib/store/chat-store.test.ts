import { describe, expect, test } from "bun:test";

await import("@/test/dom");

describe("chat store draft", () => {
  test("a saved draft is restored when the store first loads, with added files' chips as names", async () => {
    // As on a page load: the draft is in storage before the store module runs.
    localStorage.setItem(
      "local-chat-store",
      JSON.stringify({ state: { input: "my long draft [@a.pdf](upload:u1)" }, version: 0 }),
    );
    const { useChatStore } = await import("./chat-store");

    expect(useChatStore.persist.hasHydrated()).toBe(true);
    expect(useChatStore.getState().input).toBe("my long draft [@a.pdf](name:)");
    localStorage.removeItem("local-chat-store");
  });
});
