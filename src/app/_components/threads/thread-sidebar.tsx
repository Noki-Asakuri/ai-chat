import { api } from "@/convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { ThreadGroup } from "./thread-group";
import { ThreadUserProfile } from "./thread-user-profile";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

import { useChatStore } from "@/lib/chat/store";
import type { Thread } from "@/lib/types";
import { fromUUID } from "@/lib/utils";

const THREAD_LOCAL_STORAGE_KEY = "threads";

function groupThreadsByDate(threads: Thread[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize 'now' to the start of today for comparison

  const today = new Date(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const groupedThreads = {
    pinned: [],
    today: [],
    yesterday: [],
    sevenDaysAgo: [], // This will represent "Within the last 7 days but not Today/Yesterday"
    older: [],
  } as {
    pinned: Thread[];
    today: Thread[];
    yesterday: Thread[];
    sevenDaysAgo: Thread[];
    older: Thread[];
  };

  threads.forEach((thread) => {
    const threadUpdatedAt = new Date(thread.updatedAt);
    threadUpdatedAt.setHours(0, 0, 0, 0); // Normalize thread's date for comparison

    if (thread.pinned) {
      groupedThreads.pinned.push(thread);
    } else if (threadUpdatedAt.getTime() === today.getTime()) {
      groupedThreads.today.push(thread);
    } else if (threadUpdatedAt.getTime() === yesterday.getTime()) {
      groupedThreads.yesterday.push(thread);
    } else if (threadUpdatedAt >= sevenDaysAgo && threadUpdatedAt < yesterday) {
      // This captures dates within the last 7 days, excluding today and yesterday
      groupedThreads.sevenDaysAgo.push(thread);
    } else {
      groupedThreads.older.push(thread);
    }
  });

  for (const key in groupedThreads) {
    groupedThreads[key as keyof typeof groupedThreads].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return groupedThreads;
}

const DEFAULT_TITLE = "AI Chat";

export function ThreadSidebar() {
  const { threadId } = useParams<{ threadId?: string }>();

  const threads = useQuery(api.threads.getAllThreads);
  const setThreads = useChatStore((state) => state.setThreads);

  const localThreads = JSON.parse(
    localStorage.getItem(THREAD_LOCAL_STORAGE_KEY) ?? "[]",
  ) as typeof threads;
  const groupedThreads = groupThreadsByDate(threads ?? localThreads ?? []);

  useEffect(() => {
    if (threads) {
      localStorage.setItem(THREAD_LOCAL_STORAGE_KEY, JSON.stringify(threads));
      setThreads(threads);
    }
  }, [threads]);

  useEffect(() => {
    const thread = threads?.find((thread) => thread._id === fromUUID(threadId));
    if (!thread) return;

    document.title = `${thread.title} - ${DEFAULT_TITLE}`;
  }, [threadId, threads]);

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <span className="text-center text-lg">AI Chat</span>
      </SidebarHeader>

      <SidebarContent>
        <Link
          href="/"
          className="hover:bg-primary/20 bg-sidebar rounded-md border px-3 py-1.5 text-center transition-colors"
        >
          <span className="line-clamp-1 w-full text-sm">Create new thread</span>
        </Link>

        <div className="custom-scroll space-y-2 overflow-y-auto pr-1">
          <ThreadGroup threads={groupedThreads.pinned} title="Pinned" />
          <ThreadGroup threads={groupedThreads.today} title="Today" />
          <ThreadGroup threads={groupedThreads.yesterday} title="Yesterday" />
          <ThreadGroup threads={groupedThreads.sevenDaysAgo} title="Last 7 days" />
          <ThreadGroup threads={groupedThreads.older} title="Older" />
        </div>
      </SidebarContent>

      <SidebarFooter>
        <hr />
        <ThreadUserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
