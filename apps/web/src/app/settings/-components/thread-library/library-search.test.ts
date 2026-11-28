import { describe, expect, test } from "bun:test";

import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import {
  LIBRARY_SEARCH_DEFAULTS,
  countPopoverFilters,
  dayBounds,
  getPageItems,
  getViewCounts,
  librarySearchSchema,
  matchesFilters,
  paginate,
  sortThreads,
  type LibrarySearch,
  type LibraryThread,
} from "./library-search";

// SAFETY: The filters only compare ids, so plain strings can stand in for document ids.
// eslint-disable-next-line typescript/no-unsafe-type-assertion
const WORK = "group_work" as Id<"groups">;
// SAFETY: As above.
// eslint-disable-next-line typescript/no-unsafe-type-assertion
const HOME = "group_home" as Id<"groups">;
const GROUP_TITLES = new Map([
  [WORK, "Work"],
  [HOME, "Home"],
]);

let nextId = 0;
function thread(overrides: Partial<LibraryThread> = {}): LibraryThread {
  nextId += 1;
  return {
    // SAFETY: As above.
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    _id: `thread_${nextId}` as Id<"threads">,
    _creationTime: new Date(2026, 0, 10).getTime(),
    title: `Thread ${nextId}`,
    updatedAt: new Date(2026, 0, 10).getTime(),
    pinned: false,
    settled: false,
    shared: false,
    status: "complete",
    groupId: null,
    branchedFrom: undefined,
    latestModel: "test/model",
    messageCount: 4,
    attachmentCount: 0,
    ...overrides,
  };
}

function search(overrides: Partial<LibrarySearch> = {}): LibrarySearch {
  return { ...LIBRARY_SEARCH_DEFAULTS, ...overrides };
}

describe("librarySearchSchema", () => {
  test("falls back to defaults for invalid values", () => {
    const parsed = librarySearchSchema.parse({ view: "nope", size: 13, from: "yesterday", msgMin: -2, page: 0 });
    expect(parsed).toMatchObject({ view: "all", size: 25, from: undefined, msgMin: undefined, page: 1 });
  });
});

describe("matchesFilters", () => {
  test("matches titles case-insensitively", () => {
    expect(matchesFilters(thread({ title: "Rust lifetimes" }), search({ q: "  rust " }))).toBe(true);
    expect(matchesFilters(thread({ title: "Rust lifetimes" }), search({ q: "python" }))).toBe(false);
  });

  test("filters by group, including ungrouped", () => {
    const grouped = thread({ groupId: WORK });
    const ungrouped = thread();
    expect(matchesFilters(grouped, search({ group: WORK }))).toBe(true);
    expect(matchesFilters(ungrouped, search({ group: WORK }))).toBe(false);
    expect(matchesFilters(ungrouped, search({ group: "none" }))).toBe(true);
    expect(matchesFilters(grouped, search({ group: "none" }))).toBe(false);
  });

  test("treats pending and streaming threads as running", () => {
    expect(matchesFilters(thread({ status: "streaming" }), search({ status: "running" }))).toBe(true);
    expect(matchesFilters(thread({ status: "pending" }), search({ status: "running" }))).toBe(true);
    expect(matchesFilters(thread({ status: "complete" }), search({ status: "running" }))).toBe(false);
  });

  test("includes the whole of the last day in a date range", () => {
    const lateOnTheFifteenth = thread({ updatedAt: new Date(2026, 0, 15, 23, 59).getTime() });
    expect(matchesFilters(lateOnTheFifteenth, search({ from: "2026-01-15", to: "2026-01-15" }))).toBe(true);
    expect(matchesFilters(lateOnTheFifteenth, search({ to: "2026-01-14" }))).toBe(false);
    expect(dayBounds("2026-01-15", "end")).toBe(new Date(2026, 0, 16).getTime() - 1);
  });

  test("filters dates by creation time when asked", () => {
    const row = thread({ _creationTime: new Date(2025, 5, 1).getTime(), updatedAt: new Date(2026, 0, 20).getTime() });
    expect(matchesFilters(row, search({ from: "2026-01-01" }))).toBe(true);
    expect(matchesFilters(row, search({ date: "created", from: "2026-01-01" }))).toBe(false);
  });

  test("applies count ranges and leaves uncounted threads out of them", () => {
    expect(matchesFilters(thread({ messageCount: 10 }), search({ msgMin: 5, msgMax: 10 }))).toBe(true);
    expect(matchesFilters(thread({ messageCount: 11 }), search({ msgMax: 10 }))).toBe(false);
    expect(matchesFilters(thread({ messageCount: null }), search({ msgMin: 0 }))).toBe(false);
    expect(matchesFilters(thread({ messageCount: null }), search())).toBe(true);
    expect(matchesFilters(thread({ attachmentCount: 2 }), search({ attMin: 1 }))).toBe(true);
  });
});

describe("getViewCounts", () => {
  test("counts each view, where a thread can be in several", () => {
    const counts = getViewCounts([
      thread({ pinned: true }),
      thread({ settled: true, shared: true }),
      thread(),
    ]);
    expect(counts).toEqual({ all: 3, active: 2, settled: 1, pinned: 1, shared: 1 });
  });
});

describe("countPopoverFilters", () => {
  test("counts a range once, whichever ends are set", () => {
    expect(countPopoverFilters(search())).toBe(0);
    expect(countPopoverFilters(search({ status: "error", from: "2026-01-01", to: "2026-01-02", msgMax: 3 }))).toBe(3);
  });
});

describe("sortThreads", () => {
  test("sorts across all threads, breaking ties by most recent update", () => {
    const older = thread({ messageCount: 5, updatedAt: 1 });
    const newer = thread({ messageCount: 5, updatedAt: 2 });
    const most = thread({ messageCount: 9, updatedAt: 0 });

    expect(sortThreads([older, most, newer], "messages", "desc", GROUP_TITLES)).toEqual([most, newer, older]);
    expect(sortThreads([older, most, newer], "messages", "asc", GROUP_TITLES)).toEqual([newer, older, most]);
  });

  test("keeps ungrouped threads last when sorting by group", () => {
    const work = thread({ groupId: WORK });
    const home = thread({ groupId: HOME });
    const none = thread();

    expect(sortThreads([none, work, home], "group", "asc", GROUP_TITLES)).toEqual([home, work, none]);
    expect(sortThreads([none, work, home], "group", "desc", GROUP_TITLES)).toEqual([work, home, none]);
  });

  test("orders titles naturally", () => {
    const ten = thread({ title: "Chat 10" });
    const two = thread({ title: "chat 2" });
    expect(sortThreads([ten, two], "title", "asc", GROUP_TITLES)).toEqual([two, ten]);
  });
});

describe("paginate", () => {
  test("clamps the page to the last one", () => {
    const rows = Array.from({ length: 12 }, () => thread());
    const page = paginate(rows, 9, 5);
    expect(page).toMatchObject({ page: 3, pageCount: 3, start: 11, end: 12 });
    expect(page.rows).toHaveLength(2);
  });

  test("reports an empty list as one empty page", () => {
    expect(paginate([], 1, 25)).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0 });
  });
});

describe("getPageItems", () => {
  test("shows every page when there are few", () => {
    expect(getPageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  test("collapses distant pages into gaps", () => {
    expect(getPageItems(1, 12)).toEqual([1, 2, 3, 4, 5, null, 12]);
    expect(getPageItems(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(getPageItems(12, 12)).toEqual([1, null, 8, 9, 10, 11, 12]);
  });
});
