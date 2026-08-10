import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { useEffect, useState } from "react";

import { Separator } from "../ui/separator";

import { ThreadItem } from "./thread-item";

type UngroupedThreadGroupProps = {
  threads: Doc<"threads">[];
};

export function UngroupedThreadGroup({ threads }: UngroupedThreadGroupProps) {
  const [now, setNow] = useState(() => Date.now());
  const pinnedThreads = threads.filter((thread) => thread.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
  const recentThreads = threads.filter((thread) => !thread.pinned).sort((a, b) => b.updatedAt - a.updatedAt);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-1" data-slot="thread-ungrouped-list">
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
