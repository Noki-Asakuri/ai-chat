import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { usePaginatedQuery } from "convex/react";
import { ChevronRightIcon, PlusIcon } from "lucide-react";

import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Separator } from "../ui/separator";

import { ROW_SCALE } from "./sidebar-scale";
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
        className={cn(
          ROW_SCALE,
          "mt-auto flex min-h-0 flex-col gap-0.5 pt-3",
          !expandedSettled && "max-h-1/2 shrink-0",
        )}
        onOpenChange={() => onExpandedChange(false)}
      >
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="group h-auto w-full justify-start gap-2 px-(--row-px) py-1 text-xs font-medium text-muted-foreground hover:text-sidebar-foreground"
            />
          }
        >
          <span>Settled</span>
          <Separator className="min-w-4 flex-1" />
          <ChevronRightIcon className="size-(--row-icon) transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none" />
        </CollapsibleTrigger>

        <CollapsibleContent className="flex h-(--collapsible-panel-height) min-h-0 scrollbar-gutter-stable flex-col gap-0.5 overflow-y-auto transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none [&[hidden]:not([hidden='until-found'])]:hidden">
          {settledThreads.map((thread) => (
            <ThreadItem key={thread._id} thread={thread} now={now} />
          ))}

          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full shrink-0 justify-start px-(--row-px) py-1.5 text-xs text-muted-foreground hover:text-sidebar-foreground"
              disabled={status === "LoadingMore"}
              onClick={() => {
                onExpandedChange(true);
                loadMore(SETTLED_THREADS_PAGE_SIZE);
              }}
            >
              <PlusIcon data-icon="inline-start" className="size-(--row-icon)" />
              {status === "LoadingMore" ? "Loading..." : "Show more"}
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    )
  );
}
