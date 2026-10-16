import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { usePaginatedQuery } from "convex/react";
import { ChevronRightIcon, PlusIcon } from "lucide-react";

import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Separator } from "../ui/separator";

import { ThreadItem } from "./thread-item";

import { cn } from "@/lib/utils";

type SettledThreadsProps = {
  groupId: Id<"groups"> | null;
  searchQuery: string;
  now: number;
  expandedSettled: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

const SETTLED_THREADS_PAGE_SIZE = 10;

export function SettledThreads({
  groupId,
  searchQuery,
  now,
  expandedSettled,
  onExpandedChange,
}: SettledThreadsProps) {
  const {
    results: settledThreads,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.functions.threads.listSettledThreads,
    { groupId, query: searchQuery },
    { initialNumItems: SETTLED_THREADS_PAGE_SIZE },
  );

  return (
    settledThreads.length > 0 && (
      <Collapsible
        className={cn("mt-auto flex min-h-0 flex-col gap-1 pt-1", !expandedSettled && "max-h-1/2 shrink-0")}
        onOpenChange={() => onExpandedChange(false)}
      >
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
          <ChevronRightIcon className="transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none" />
        </CollapsibleTrigger>

        <CollapsibleContent className="h-(--collapsible-panel-height) min-h-0 scrollbar-gutter-stable overflow-y-auto transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none [&[hidden]:not([hidden='until-found'])]:hidden">
          {settledThreads.map((thread) => (
            <ThreadItem key={thread._id} thread={thread} now={now} />
          ))}

          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start px-2 text-muted-foreground"
              disabled={status === "LoadingMore"}
              onClick={() => {
                onExpandedChange(true);
                loadMore(SETTLED_THREADS_PAGE_SIZE);
              }}
            >
              <PlusIcon data-icon="inline-start" />
              {status === "LoadingMore" ? "Loading..." : "Show more"}
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    )
  );
}
