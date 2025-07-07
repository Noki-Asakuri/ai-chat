import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useDocumentTitle } from "@uidotdev/usehooks";
import { useEffect, useMemo, useRef } from "react";
import { NavLink, useParams } from "react-router";

import { ThreadItem } from "./thread-items";
import { ThreadUserProfile } from "./thread-user-profile";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { TypographyP } from "@/components/ui/typography";

import { useChatStore } from "@/lib/chat/store";
import { groupByDate } from "@/lib/threads/group-by-date";
import type { Thread } from "@/lib/types";
import { fromUUID } from "@/lib/utils";

const THREAD_LOCAL_STORAGE_KEY = "threads";
const DEFAULT_TITLE = "AI Chat";

type VirtualizedThread =
  | { type: "header"; title: string; count: number }
  | { type: "thread"; data: Thread };

export function ThreadSidebar() {
  return (
    <Sidebar
      variant="inset"
      className="bg-sidebar/40 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar backdrop-blur-md backdrop-saturate-150"
    >
      <div className="pointer-events-none absolute inset-0 -z-5 group-data-[disable-blur=true]/sidebar-provider:hidden">
        <div className="from-sidebar h-1/2 w-full bg-gradient-to-b from-5% to-transparent to-80%" />
        <div className="from-sidebar h-1/2 w-full bg-gradient-to-t from-5% to-transparent to-80%" />
      </div>

      <SidebarHeader>
        <span className="text-center text-xl">AI Chat</span>
      </SidebarHeader>

      <SidebarContent className="flex flex-1 flex-col gap-2">
        <NavLink
          to="/"
          className="hover:bg-primary/20 bg-sidebar mx-2 rounded-md border px-3 py-1.5 text-center transition-colors"
        >
          <span className="line-clamp-1 w-full">Create new thread</span>
        </NavLink>

        <ThreadsContent />
      </SidebarContent>

      <SidebarFooter>
        <hr className="border-sidebar-accent" />
        <ThreadUserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}

function ThreadsContent() {
  const parentRef = useRef<HTMLDivElement>(null);
  const { threadId } = useParams<{ threadId?: string }>();

  const { data: threads } = useQuery(convexQuery(api.threads.getAllThreads, {}));
  const setThreads = useChatStore((state) => state.setThreads);

  const threadTitle = threads?.find((thread) => thread._id === fromUUID(threadId))?.title;

  const localThreads = JSON.parse(
    localStorage.getItem(THREAD_LOCAL_STORAGE_KEY) ?? "[]",
  ) as typeof threads;
  const groupedThreads = groupByDate(threads ?? localThreads ?? []);

  const virtualizedThreads = useMemo(() => {
    const allThreads: VirtualizedThread[] = [];

    if (groupedThreads.pinned.length > 0) {
      allThreads.push({ type: "header", title: "Pinned", count: groupedThreads.pinned.length });
      allThreads.push(
        ...groupedThreads.pinned.map((thread) => ({ type: "thread" as const, data: thread })),
      );
    }
    if (groupedThreads.today.length > 0) {
      allThreads.push({ type: "header", title: "Today", count: groupedThreads.today.length });
      allThreads.push(
        ...groupedThreads.today.map((thread) => ({ type: "thread" as const, data: thread })),
      );
    }
    if (groupedThreads.yesterday.length > 0) {
      allThreads.push({
        type: "header",
        title: "Yesterday",
        count: groupedThreads.yesterday.length,
      });
      allThreads.push(
        ...groupedThreads.yesterday.map((thread) => ({ type: "thread" as const, data: thread })),
      );
    }
    if (groupedThreads.sevenDaysAgo.length > 0) {
      allThreads.push({
        type: "header",
        title: "Last 7 days",
        count: groupedThreads.sevenDaysAgo.length,
      });
      allThreads.push(
        ...groupedThreads.sevenDaysAgo.map((thread) => ({ type: "thread" as const, data: thread })),
      );
    }
    if (groupedThreads.older.length > 0) {
      allThreads.push({ type: "header", title: "Older", count: groupedThreads.older.length });
      allThreads.push(
        ...groupedThreads.older.map((thread) => ({ type: "thread" as const, data: thread })),
      );
    }
    return allThreads;
  }, [groupedThreads]);

  useEffect(() => {
    if (threads) {
      localStorage.setItem(THREAD_LOCAL_STORAGE_KEY, JSON.stringify(threads));
      setThreads(threads);
    }
  }, [threads, setThreads]);

  const rowVirtualizer = useVirtualizer({
    count: virtualizedThreads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    gap: 4,
  });

  useDocumentTitle(threadTitle ? `${threadTitle} - ${DEFAULT_TITLE}` : DEFAULT_TITLE);

  return (
    <div
      ref={parentRef}
      className="custom-scroll h-full w-full overflow-y-auto px-2"
      style={{ scrollbarGutter: "stable both-edges" }}
    >
      <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const item = virtualizedThreads[virtualItem.index]!;

          return (
            <div
              key={virtualItem.key}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              {item.type === "header" ? (
                <TypographyP className="text-sidebar-accent-foreground flex items-center justify-between font-semibold">
                  {item.title}

                  <span className="text-sidebar-accent-foreground/70 text-sm">{item.count}</span>
                </TypographyP>
              ) : (
                <ThreadItem thread={item.data} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
