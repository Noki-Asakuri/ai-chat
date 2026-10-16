import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { ClientOnly, useParams } from "@tanstack/react-router";

import { useMutation } from "convex/react";
import { FolderIcon, FolderPlusIcon, SearchIcon, SquarePenIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Skeleton } from "../ui/skeleton";

import { ThreadDialogs } from "./thread-dialogs";
import { ThreadListToolbar } from "./thread-list-toolbar";
import { SettledThreads } from "./settled-threads";
import { ActiveThreads } from "./active-threads";

import { convexQuery } from "@convex-dev/react-query";
import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";
import { cn, fromUUID } from "@/lib/utils";

export function ThreadContents() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ClientOnly fallback={<ThreadListFallback />}>
        <ThreadListWrapper />
      </ClientOnly>
    </div>
  );
}

function ThreadListFallback() {
  return (
    <output className="flex min-h-0 flex-1 flex-col" aria-label="Loading conversations">
      <span className="sr-only">Loading conversations</span>

      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 px-2 pb-1.5">
          <InputGroup className="min-w-0 flex-1 rounded-md border-transparent bg-input/30 shadow-none">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>

            <InputGroupInput
              type="search"
              placeholder="Search"
              aria-label="Search threads in active group"
              className="font-mono text-sm placeholder:text-muted-foreground"
              disabled
            />
          </InputGroup>

          <Button size="icon" variant="ghost" aria-label="Select group" disabled>
            <FolderIcon />
          </Button>

          <Button size="icon" variant="ghost" aria-label="Create group" disabled>
            <FolderPlusIcon />
          </Button>

          <Button size="icon" variant="ghost" aria-label="New chat" disabled>
            <SquarePenIcon />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-2.5 pl-2">
          <ThreadRowsSkeleton />
        </div>
      </div>
    </output>
  );
}

function ThreadRowsSkeleton() {
  return (
    <>
      <ThreadSkeleton titleWidth="w-[82%]" />
      <ThreadSkeleton titleWidth="w-[46%]" />
      <ThreadSkeleton titleWidth="w-[74%]" />
      <ThreadSkeleton titleWidth="w-[42%]" />
      <ThreadSkeleton titleWidth="w-[84%]" />
      <ThreadSkeleton titleWidth="w-[76%]" />
      <ThreadSkeleton titleWidth="w-[68%]" />
      <ThreadSkeleton titleWidth="w-[88%]" />
      <ThreadSkeleton titleWidth="w-[54%]" />
    </>
  );
}

function ThreadSkeleton({
  titleWidth,
}: {
  titleWidth:
    | "w-[42%]"
    | "w-[46%]"
    | "w-[54%]"
    | "w-[64%]"
    | "w-[68%]"
    | "w-[72%]"
    | "w-[74%]"
    | "w-[76%]"
    | "w-[82%]"
    | "w-[84%]"
    | "w-[88%]";
}) {
  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Skeleton className="size-3.5 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>

        <Skeleton className="h-3 w-10 shrink-0" />
      </div>

      <Skeleton className={cn("h-3.5", titleWidth)} />
    </div>
  );
}

function ThreadListWrapper() {
  const activeGroupId = useThreadStore((state) => state.activeGroupId);

  return <ActiveGroupThreadList activeGroupId={activeGroupId} />;
}

function ActiveGroupThreadList({ activeGroupId }: { activeGroupId: Id<"groups"> | null }) {
  const localCache = useThreadStore((state) => state.groupedThreads);
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  const lastSyncedThreadIdRef = useRef<Id<"threads"> | null>(null);
  const routeThreadId = fromUUID<Id<"threads">>(params?.threadId);
  const markThreadViewed = useMutation(api.functions.threads.markThreadViewed);

  const { data } = useQuery({
    ...convexQuery(api.functions.groups.listGroups, { activeGroupId }),
    initialData: localCache.activeGroupId === activeGroupId ? localCache : undefined,
  });
  const { data: routeThreadTitle } = useQuery(
    convexQuery(
      api.functions.threads.getThreadPageMeta,
      routeThreadId ? { threadId: routeThreadId } : "skip",
    ),
  );

  useEffect(() => {
    if (!data) return;

    threadStoreActions.setGroupedThreads(data);

    if (routeThreadId && lastSyncedThreadIdRef.current !== routeThreadId) {
      const routeThread = data.threads.find((thread) => thread._id === routeThreadId);
      if (routeThread) {
        threadStoreActions.setActiveGroupId(routeThread.groupId);
        lastSyncedThreadIdRef.current = routeThreadId;
        return;
      }

      if (routeThreadTitle) {
        threadStoreActions.setActiveGroupId(routeThreadTitle.groupId);
        lastSyncedThreadIdRef.current = routeThreadId;
        return;
      }
    }

    const storedActiveGroupId = useThreadStore.getState().activeGroupId;
    if (storedActiveGroupId && !data.groups.some((group) => group._id === storedActiveGroupId)) {
      threadStoreActions.setActiveGroupId(null);
    }
  }, [data, routeThreadId, routeThreadTitle]);

  useEffect(() => {
    if (!data || !routeThreadId) return;

    const routeThread = data.threads.find((thread) => thread._id === routeThreadId) ?? routeThreadTitle;
    if (!routeThread || routeThread.status !== "complete") return;
    if (
      routeThread.lastViewedAt !== undefined &&
      routeThread.lastViewedAt !== null &&
      routeThread.lastViewedAt >= routeThread.updatedAt
    )
      return;

    void markThreadViewed({ threadId: routeThreadId }).catch((cause: unknown) => {
      console.error("[Thread] Mark thread viewed error:", cause);
    });
  }, [data, markThreadViewed, routeThreadId, routeThreadTitle]);

  return <ThreadList data={data} groups={data?.groups ?? localCache.groups} />;
}

type ListGroupData = (typeof api.functions.groups.listGroups)["_returnType"];

type ThreadListProps = {
  data: ListGroupData | undefined;
  groups: ListGroupData["groups"];
};

function ThreadList({ data, groups }: ThreadListProps) {
  const [now, setNow] = useState(() => Date.now());
  const [expandedSettled, setExpandedSettled] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const activeGroupId = useThreadStore((state) => state.activeGroupId);

  const activeThreads = data?.threads.filter((thread) => thread.settled !== true) ?? [];
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredThreads = normalizedSearchQuery
    ? activeThreads.filter((thread) => thread.title.toLocaleLowerCase().includes(normalizedSearchQuery))
    : activeThreads;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ThreadListToolbar groups={groups} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div data-slot="thread-list-container" className="flex min-h-0 flex-1 flex-col pr-2.5 pl-2">
        {data ? (
          <div className="flex min-h-0 flex-1 flex-col" data-slot="thread-sections">
            <ActiveThreads threads={filteredThreads} now={now} expandedSettled={expandedSettled} />
            <SettledThreads
              groupId={activeGroupId}
              searchQuery={normalizedSearchQuery}
              now={now}
              expandedSettled={expandedSettled}
              onExpandedChange={setExpandedSettled}
            />
          </div>
        ) : (
          <ThreadRowsSkeleton />
        )}
      </div>

      <ThreadDialogs />
    </div>
  );
}
