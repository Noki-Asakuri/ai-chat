import { describe, expect, test } from "bun:test";

import { extractNameFromUrl, getShortestNavigationDirection, wrapIndex } from "./utils";

describe("image lightbox utilities", () => {
  test("wraps an index after the image list shrinks", () => {
    expect(wrapIndex(4, 2)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(2, 0)).toBe(0);
  });

  test("selects the shortest circular navigation direction", () => {
    expect(getShortestNavigationDirection(0, 4, 5)).toBe(-1);
    expect(getShortestNavigationDirection(4, 0, 5)).toBe(1);
    expect(getShortestNavigationDirection(2, 2, 5)).toBe(0);
  });

  test("extracts a name without query parameters or fragments", () => {
    expect(extractNameFromUrl("https://example.com/image.png?size=large#preview")).toBe("image.png");
    expect(extractNameFromUrl("https://example.com/folder/")).toBeUndefined();
  });
});
