import { afterEach, describe, expect, test } from "bun:test";

await import("@/test/dom");

afterEach(() => localStorage.removeItem("local-chat-store"));

describe("chat store draft", () => {
  test("a saved draft is restored when the store first loads, with added files' chips as names", async () => {
    // As on a page load: the draft is in storage before the store module runs. The query loads a
    // fresh copy of the module, even when another test file has already loaded it.
    localStorage.setItem(
      "local-chat-store",
      JSON.stringify({ state: { input: "my long draft [@a.pdf](upload:u1)" }, version: 0 }),
    );
    const { useChatStore } = await import(`./chat-store.ts?fresh-load=${Date.now()}`);

    expect(useChatStore.persist.hasHydrated()).toBe(true);
    expect(useChatStore.getState().input).toBe("my long draft [@a.pdf](name:)");
  });
});
