import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

type GroupColor = { dot: string; chip: string };

// Groups take colors in creation order, so the first eight never share one.
const GROUP_COLORS: ReadonlyArray<GroupColor> = [
  { dot: "bg-sky-500", chip: "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300" },
  { dot: "bg-violet-500", chip: "bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300" },
  { dot: "bg-amber-500", chip: "bg-amber-500/14 text-amber-800 ring-amber-500/30 dark:text-amber-300" },
  { dot: "bg-emerald-500", chip: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" },
  { dot: "bg-rose-500", chip: "bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:text-rose-300" },
  { dot: "bg-teal-500", chip: "bg-teal-500/12 text-teal-700 ring-teal-500/25 dark:text-teal-300" },
  { dot: "bg-orange-500", chip: "bg-orange-500/12 text-orange-700 ring-orange-500/25 dark:text-orange-300" },
  { dot: "bg-fuchsia-500", chip: "bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/25 dark:text-fuchsia-300" },
];

export const UNGROUPED_COLOR: GroupColor = {
  dot: "bg-muted-foreground/40",
  chip: "bg-muted text-muted-foreground ring-border",
};

export type { GroupColor };

/** Keyed by plain string, so a group id read back from the URL can be looked up as is. */
export function getGroupColors(groupIds: ReadonlyArray<Id<"groups">>): Map<string, GroupColor> {
  return new Map(groupIds.map((id, index) => [id, GROUP_COLORS[index % GROUP_COLORS.length] ?? UNGROUPED_COLOR]));
}
