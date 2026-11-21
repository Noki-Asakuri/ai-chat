import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { ROW_SCALE } from "./sidebar-scale";
import { ThreadItem } from "./thread-item";

import { cn } from "@/lib/utils";

type ActiveThreadsProps = {
  threads: Doc<"threads">[];
  now: number;
  expandedSettled: boolean;
};

export function ActiveThreads({ threads, now, expandedSettled }: ActiveThreadsProps) {
  const pinnedThreads = threads
    .filter((thread) => thread.pinned)
    .toSorted((a, b) => b.updatedAt - a.updatedAt);
  const recentThreads = threads
    .filter((thread) => !thread.pinned)
    .toSorted((a, b) => b.updatedAt - a.updatedAt);
  const labelled = pinnedThreads.length > 0 && recentThreads.length > 0;

  return (
    <div
      data-slot="active-threads"
      className={cn(
        ROW_SCALE,
        "flex min-h-0 flex-1 scrollbar-gutter-stable flex-col gap-3 overflow-y-auto",
        expandedSettled && "max-h-1/2 flex-initial shrink-0",
      )}
    >
      <ThreadSection label="Pinned" showLabel={labelled} threads={pinnedThreads} now={now} />
      <ThreadSection label="Recent" showLabel={labelled} threads={recentThreads} now={now} />
    </div>
  );
}

type ThreadSectionProps = {
  label: string;
  showLabel: boolean;
  threads: Doc<"threads">[];
  now: number;
};

function ThreadSection({ label, showLabel, threads, now }: ThreadSectionProps) {
  if (threads.length === 0) return null;

  return (
    <section aria-label={`${label} threads`} className="flex shrink-0 flex-col gap-0.5">
      {showLabel && (
        <h3 className="px-(--row-px) pb-1 text-xs font-medium text-muted-foreground" aria-hidden="true">
          {label}
        </h3>
      )}
      {threads.map((thread) => (
        <ThreadItem key={thread._id} thread={thread} now={now} />
      ))}
    </section>
  );
}
