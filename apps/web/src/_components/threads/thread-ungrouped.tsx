import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Separator } from "../ui/separator";

import { ThreadItem } from "./thread-item";

type UngroupedThreadGroupProps = {
  threads: Doc<"threads">[];
};

export function UngroupedThreadGroup({ threads }: UngroupedThreadGroupProps) {
  const [now, setNow] = useState(() => Date.now());
  const activeThreads = threads.filter((thread) => thread.settled !== true);
  const settledThreads = threads
    .filter((thread) => thread.settled === true)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const pinnedThreads = activeThreads
    .filter((thread) => thread.pinned)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const recentThreads = activeThreads
    .filter((thread) => !thread.pinned)
    .sort((a, b) => b.updatedAt - a.updatedAt);

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

      {settledThreads.length > 0 && (
        <Collapsible defaultOpen className="mt-1 flex flex-col gap-1">
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="group w-full justify-start gap-2 px-2 text-muted-foreground"
              />
            }
          >
            <span>Settled</span>
            <Separator className="min-w-4 flex-1" />
            <ChevronRightIcon className="transition-transform group-data-panel-open:rotate-90" />
          </CollapsibleTrigger>

          <CollapsibleContent className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-150 ease-out [&[hidden]:not([hidden='until-found'])]:hidden data-ending-style:h-0 data-starting-style:h-0">
            {settledThreads.map((thread) => (
              <ThreadItem key={thread._id} thread={thread} now={now} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
