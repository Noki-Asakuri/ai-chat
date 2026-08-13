import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { usePaginatedQuery } from "convex/react";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Separator } from "../ui/separator";

import { ThreadItem } from "./thread-item";

type UngroupedThreadGroupProps = {
  threads: Doc<"threads">[];
  groupId: Id<"groups"> | null;
  searchQuery: string;
  hasMore: boolean;
  onLoadMore: () => void;
};

const SETTLED_THREADS_PAGE_SIZE = 10;

export function UngroupedThreadGroup({
  threads,
  groupId,
  searchQuery,
  hasMore,
  onLoadMore,
}: UngroupedThreadGroupProps) {
  const [now, setNow] = useState(() => Date.now());
  const {
    results: settledThreads,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.functions.threads.listSettledThreads,
    { groupId, query: searchQuery },
    { initialNumItems: SETTLED_THREADS_PAGE_SIZE },
  );
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

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start px-2 text-muted-foreground"
          onClick={onLoadMore}
        >
          <PlusIcon data-icon="inline-start" />
          Show more
        </Button>
      )}

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

          <CollapsibleContent className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
            {settledThreads.map((thread) => (
              <ThreadItem key={thread._id} thread={thread} now={now} />
            ))}

            {(status === "CanLoadMore" || status === "LoadingMore") && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-2 text-muted-foreground"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(SETTLED_THREADS_PAGE_SIZE)}
              >
                <PlusIcon data-icon="inline-start" />
                {status === "LoadingMore" ? "Loading..." : "Show more"}
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
