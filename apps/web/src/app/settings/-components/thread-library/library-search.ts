import type { FunctionReturnType } from "convex/server";
import { z } from "zod/v4";

import type { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

export type ThreadLibrary = FunctionReturnType<typeof api.functions.threads.listThreadLibrary>;
export type LibraryThread = ThreadLibrary["threads"][number];
export type LibraryGroup = ThreadLibrary["groups"][number];

export const LIBRARY_VIEWS = ["all", "active", "settled", "pinned", "shared"] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number];

export const LIBRARY_STATUSES = ["all", "running", "complete", "error"] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

export const LIBRARY_SORTS = ["updated", "created", "title", "group", "status", "messages", "attachments"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const LIBRARY_PAGE_SIZES = [10, 25, 50, 100] as const;
export type LibraryPageSize = (typeof LIBRARY_PAGE_SIZES)[number];

export function isLibraryStatus(value: string | null | undefined): value is LibraryStatus {
  return LIBRARY_STATUSES.some((status) => status === value);
}

export function isLibraryDateField(value: string | null | undefined): value is "updated" | "created" {
  return value === "updated" || value === "created";
}

export function toPageSize(value: string | null | undefined): LibraryPageSize | undefined {
  return LIBRARY_PAGE_SIZES.find((size) => String(size) === String(value));
}

/** "all" matches every thread, "none" matches ungrouped threads, anything else is a group id. */
export const ALL_GROUPS = "all";
export const UNGROUPED = "none";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const count = z.number().int().min(0).max(1_000_000).optional().catch(undefined);
const day = z.string().regex(DATE_PATTERN).optional().catch(undefined);

export const librarySearchSchema = z.object({
  q: z.string().default("").catch(""),
  view: z.enum(LIBRARY_VIEWS).default("all").catch("all"),
  group: z.string().min(1).default(ALL_GROUPS).catch(ALL_GROUPS),
  status: z.enum(LIBRARY_STATUSES).default("all").catch("all"),
  date: z.enum(["updated", "created"]).default("updated").catch("updated"),
  from: day,
  to: day,
  msgMin: count,
  msgMax: count,
  attMin: count,
  attMax: count,
  sort: z.enum(LIBRARY_SORTS).default("updated").catch("updated"),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
  page: z.number().int().min(1).default(1).catch(1),
  size: z
    .union(LIBRARY_PAGE_SIZES.map((size) => z.literal(size)))
    .default(25)
    .catch(25),
});

export type LibrarySearch = z.infer<typeof librarySearchSchema>;

export const LIBRARY_SEARCH_DEFAULTS = librarySearchSchema.parse({});

/** Changing any of these narrows or reorders the list, so selection and paging start over. */
export const LIBRARY_FILTER_KEYS = [
  "q",
  "view",
  "group",
  "status",
  "date",
  "from",
  "to",
  "msgMin",
  "msgMax",
  "attMin",
  "attMax",
] as const satisfies ReadonlyArray<keyof LibrarySearch>;

/** Filters set from the "Filters" popover, counted on its button. */
export function countPopoverFilters(search: LibrarySearch): number {
  let total = 0;
  if (search.status !== "all") total += 1;
  if (search.from !== undefined || search.to !== undefined) total += 1;
  if (search.msgMin !== undefined || search.msgMax !== undefined) total += 1;
  if (search.attMin !== undefined || search.attMax !== undefined) total += 1;
  return total;
}

export function isRunning(thread: Pick<LibraryThread, "status">): boolean {
  return thread.status === "pending" || thread.status === "streaming";
}

export function isFinished(thread: Pick<LibraryThread, "status">): boolean {
  return thread.status === "complete" || thread.status === "error";
}

export function matchesView(thread: LibraryThread, view: LibraryView): boolean {
  if (view === "active") return !thread.settled;
  if (view === "settled") return thread.settled;
  if (view === "pinned") return thread.pinned;
  if (view === "shared") return thread.shared;
  return true;
}

/** Parses a YYYY-MM-DD day as local time, so "to" covers the whole of that day where the user is. */
export function dayBounds(value: string, edge: "start" | "end"): number {
  const [year = 0, month = 1, date = 1] = value.split("-").map(Number);
  return edge === "start"
    ? new Date(year, month - 1, date).getTime()
    : new Date(year, month - 1, date + 1).getTime() - 1;
}

function inRange(value: number | null, min: number | undefined, max: number | undefined): boolean {
  if (min === undefined && max === undefined) return true;
  // A thread whose messages are not counted yet can't be shown to match a count range.
  if (value === null) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/** Every filter except the view, so the view tiles can show how many threads each view would hold. */
export function matchesFilters(thread: LibraryThread, search: LibrarySearch): boolean {
  const query = search.q.trim().toLocaleLowerCase();
  if (query.length > 0 && !thread.title.toLocaleLowerCase().includes(query)) return false;

  if (search.group === UNGROUPED ? thread.groupId !== null : search.group !== ALL_GROUPS && thread.groupId !== search.group) {
    return false;
  }

  if (search.status === "running" && !isRunning(thread)) return false;
  if (search.status === "complete" && thread.status !== "complete") return false;
  if (search.status === "error" && thread.status !== "error") return false;

  const time = search.date === "created" ? thread._creationTime : thread.updatedAt;
  if (search.from !== undefined && time < dayBounds(search.from, "start")) return false;
  if (search.to !== undefined && time > dayBounds(search.to, "end")) return false;

  if (!inRange(thread.messageCount, search.msgMin, search.msgMax)) return false;
  if (!inRange(thread.attachmentCount, search.attMin, search.attMax)) return false;

  return true;
}

export type ViewCounts = ReturnType<typeof getViewCounts>;

export function getViewCounts(threads: ReadonlyArray<LibraryThread>) {
  const counts = { all: 0, active: 0, settled: 0, pinned: 0, shared: 0 } satisfies Record<LibraryView, number>;
  for (const thread of threads) {
    for (const view of LIBRARY_VIEWS) {
      if (matchesView(thread, view)) counts[view] += 1;
    }
  }
  return counts;
}

const STATUS_ORDER = { pending: 0, streaming: 0, error: 1, complete: 2 } satisfies Record<
  LibraryThread["status"],
  number
>;
const titleCollator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export function sortThreads(
  threads: ReadonlyArray<LibraryThread>,
  sort: LibrarySort,
  dir: "asc" | "desc",
  groupTitles: ReadonlyMap<Id<"groups">, string>,
): Array<LibraryThread> {
  const groupTitle = (thread: LibraryThread) =>
    thread.groupId === null ? "" : (groupTitles.get(thread.groupId) ?? "");

  const compare = (left: LibraryThread, right: LibraryThread): number => {
    if (sort === "title") return titleCollator.compare(left.title, right.title);
    if (sort === "created") return left._creationTime - right._creationTime;
    if (sort === "messages") return (left.messageCount ?? -1) - (right.messageCount ?? -1);
    if (sort === "attachments") return left.attachmentCount - right.attachmentCount;
    if (sort === "status") {
      const leftRank = left.settled ? 3 : STATUS_ORDER[left.status];
      const rightRank = right.settled ? 3 : STATUS_ORDER[right.status];
      return leftRank - rightRank;
    }
    if (sort === "group") {
      // Ungrouped threads stay last in both directions; they have no name to order by.
      const leftTitle = groupTitle(left);
      const rightTitle = groupTitle(right);
      if (leftTitle === "" || rightTitle === "") return 0;
      return titleCollator.compare(leftTitle, rightTitle);
    }
    return left.updatedAt - right.updatedAt;
  };

  const sign = dir === "asc" ? 1 : -1;
  return threads.toSorted((left, right) => {
    if (sort === "group") {
      const leftUngrouped = left.groupId === null;
      const rightUngrouped = right.groupId === null;
      if (leftUngrouped !== rightUngrouped) return leftUngrouped ? 1 : -1;
    }
    // Ties fall back to the most recently updated first, whatever the direction.
    return compare(left, right) * sign || right.updatedAt - left.updatedAt;
  });
}

export type LibraryPage = {
  rows: Array<LibraryThread>;
  page: number;
  pageCount: number;
  start: number;
  end: number;
};

export function paginate(threads: ReadonlyArray<LibraryThread>, page: number, size: number): LibraryPage {
  const pageCount = Math.max(1, Math.ceil(threads.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const startIndex = (current - 1) * size;
  const rows = threads.slice(startIndex, startIndex + size);

  return {
    rows,
    page: current,
    pageCount,
    start: rows.length === 0 ? 0 : startIndex + 1,
    end: startIndex + rows.length,
  };
}

/** Page numbers to show, with null standing for a gap, e.g. 1 … 4 5 6 … 12. */
export function getPageItems(page: number, pageCount: number): Array<number | null> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const items: Array<number | null> = [1];
  const start = Math.max(2, Math.min(page - 1, pageCount - 4));
  const end = Math.min(pageCount - 1, Math.max(page + 1, 5));

  if (start > 2) items.push(null);
  for (let item = start; item <= end; item += 1) items.push(item);
  if (end < pageCount - 1) items.push(null);
  items.push(pageCount);

  return items;
}

export function toDayValue(time: number): string {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
}

export const DATE_PRESETS = [
  { id: "today", label: "Today", days: 0 },
  { id: "7d", label: "Last 7 days", days: 6 },
  { id: "30d", label: "Last 30 days", days: 29 },
  { id: "90d", label: "Last 90 days", days: 89 },
] as const;

export function getPresetRange(days: number, now: number) {
  const today = new Date(now);
  return {
    from: toDayValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days).getTime()),
    to: toDayValue(now),
  };
}
