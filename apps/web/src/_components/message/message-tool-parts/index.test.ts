import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MessageToolParts } from ".";
import type { ToolPart } from "./shared";

function completedWebSearch(toolCallId: string): ToolPart {
  return {
    type: "dynamic-tool",
    toolName: "web_search",
    toolCallId,
    state: "output-available",
    input: { query: toolCallId },
    output: {},
  };
}

describe("web search tool parts", function () {
  test("hides an automatic denial left by the previous limit implementation", function () {
    const deniedWebSearch = {
      type: "dynamic-tool",
      toolName: "web_search",
      toolCallId: "search-4",
      state: "approval-responded",
      input: { query: "fourth search" },
      approval: {
        id: "approval-4",
        approved: false,
        reason: "The web search limit for this request has been reached.",
      },
    } satisfies ToolPart;

    const markup = renderToStaticMarkup(
      createElement(MessageToolParts, {
        parts: [completedWebSearch("search-2"), completedWebSearch("search-3"), deniedWebSearch],
      }),
    );

    expect(markup).toContain("Ran 2 tool calls");
    expect(markup).not.toContain("Ran 3 tool calls");
  });
});
