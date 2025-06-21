import { api } from "@/convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache";

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
import { fromUUID } from "@/lib/utils";

const THREAD_LOCAL_STORAGE_KEY = "threads";
const DEFAULT_TITLE = "AI Chat";

export function ThreadSidebar() {
  const { threadId } = useParams<{ threadId?: string }>();
  const parentRef = useRef<HTMLDivElement>(null);

  const threads = useQuery(api.threads.getAllThreads);
  const setThreads = useChatStore((state) => state.setThreads);

  const threadTitle = threads?.find((thread) => thread._id === fromUUID(threadId))?.title;

  const localThreads = JSON.parse(
    localStorage.getItem(THREAD_LOCAL_STORAGE_KEY) ?? "[]",
  ) as typeof threads;
  const groupedThreads = groupByDate(threads ?? localThreads ?? []);

  const virtualizedThreads = useMemo(() => {
    const allThreads = [];
    if (groupedThreads.pinned.length > 0) {
      allThreads.push({ type: "header", title: "Pinned" });
      allThreads.push(...groupedThreads.pinned.map((thread) => ({ type: "thread", data: thread })));
    }
    if (groupedThreads.today.length > 0) {
      allThreads.push({ type: "header", title: "Today" });
      allThreads.push(...groupedThreads.today.map((thread) => ({ type: "thread", data: thread })));
    }
    if (groupedThreads.yesterday.length > 0) {
      allThreads.push({ type: "header", title: "Yesterday" });
      allThreads.push(
        ...groupedThreads.yesterday.map((thread) => ({ type: "thread", data: thread })),
      );
    }
    if (groupedThreads.sevenDaysAgo.length > 0) {
      allThreads.push({ type: "header", title: "Last 7 days" });
      allThreads.push(
        ...groupedThreads.sevenDaysAgo.map((thread) => ({ type: "thread", data: thread })),
      );
    }
    if (groupedThreads.older.length > 0) {
      allThreads.push({ type: "header", title: "Older" });
      allThreads.push(...groupedThreads.older.map((thread) => ({ type: "thread", data: thread })));
    }
    return allThreads;
  }, [groupedThreads]);

  const rowVirtualizer = useVirtualizer({
    count: virtualizedThreads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = virtualizedThreads[index];
      if (!item) return 0;
      return item.type === "header" ? 32 : 40;
    },
    overscan: 5,
  });

  useEffect(() => {
    if (threads) {
      localStorage.setItem(THREAD_LOCAL_STORAGE_KEY, JSON.stringify(threads));
      setThreads(threads);
    }
  }, [threads, setThreads]);

  useDocumentTitle(threadTitle ? `${threadTitle} - ${DEFAULT_TITLE}` : DEFAULT_TITLE);

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <span className="text-center text-xl">AI Chat</span>
      </SidebarHeader>

      <SidebarContent className="px-2 md:px-0">
        <NavLink
          to="/"
          className="hover:bg-primary/20 bg-sidebar rounded-md border px-3 py-1.5 text-center transition-colors"
        >
          <span className="line-clamp-1 w-full">Create new thread</span>
        </NavLink>

        <div ref={parentRef} className="custom-scroll max-h-full space-y-2 overflow-y-auto pr-1">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = virtualizedThreads[virtualItem.index];
              if (!item) return null;

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {item.type === "header" && "title" in item ? (
                    <TypographyP className="px-3 py-1.5 text-sm font-semibold">
                      {item.title}
                    </TypographyP>
                  ) : (
                    item.type === "thread" && "data" in item && <ThreadItem thread={item.data} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <hr />
        <ThreadUserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
