import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { Separator } from "../ui/separator";

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

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 scrollbar-gutter-stable flex-col gap-1 overflow-y-auto",
        expandedSettled && "max-h-1/2 flex-initial shrink-0",
      )}
    >
      {pinnedThreads.map((thread) => (
        <ThreadItem key={thread._id} thread={thread} now={now} />
      ))}

      {pinnedThreads.length > 0 && recentThreads.length > 0 && <Separator className="my-1" />}

      {recentThreads.map((thread) => (
        <ThreadItem key={thread._id} thread={thread} now={now} />
      ))}
    </div>
  );
}
