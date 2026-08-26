import { describe, expect, test } from "bun:test";

import { getActiveToolsWithinWebSearchLimit } from "./web-search-limit";

const toolNames = ["web_search", "image_generation"];

describe("web search tool limit", function () {
  test("keeps web search available before the third call", function () {
    const activeTools = getActiveToolsWithinWebSearchLimit(toolNames, [
      { toolCalls: [{ toolName: "web_search" }] },
      { toolCalls: [{ toolName: "web_search" }] },
    ]);

    expect(activeTools).toEqual(toolNames);
  });

  test("removes web search after the third call while retaining other tools", function () {
    const activeTools = getActiveToolsWithinWebSearchLimit(toolNames, [
      { toolCalls: [{ toolName: "web_search" }] },
      { toolCalls: [{ toolName: "image_generation" }, { toolName: "web_search" }] },
      { toolCalls: [{ toolName: "web_search" }] },
    ]);

    expect(activeTools).toEqual(["image_generation"]);
  });
});
