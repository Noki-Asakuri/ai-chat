import { describe, expect, test } from "bun:test";

import { parseWebSearchOutput } from "./web-search-tool-part";

describe("parseWebSearchOutput", function () {
  test("preserves valid results when other entries are malformed", function () {
    expect(
      parseWebSearchOutput({
        requestId: "request-1",
        results: [
          { id: "result-1", title: "Valid result", url: "https://example.com" },
          { title: "Missing URL" },
          { title: "Invalid URL", url: null },
        ],
      }),
    ).toEqual({
      requestId: "request-1",
      resolvedSearchType: null,
      results: [
        {
          id: "result-1",
          title: "Valid result",
          url: "https://example.com",
          favicon: null,
          publishedDate: null,
        },
      ],
    });
  });
});
