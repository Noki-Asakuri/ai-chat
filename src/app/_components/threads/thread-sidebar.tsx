import { api } from "@/convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache";

import Head from "next/head";
import { useEffect } from "react";
import { NavLink, useParams } from "react-router";

import { ThreadGroup } from "./thread-group";
import { ThreadUserProfile } from "./thread-user-profile";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

import { useChatStore } from "@/lib/chat/store";
import { groupByDate } from "@/lib/threads/group-by-date";
import { fromUUID } from "@/lib/utils";

const THREAD_LOCAL_STORAGE_KEY = "threads";

const DEFAULT_TITLE = "AI Chat";

export function ThreadSidebar() {
  const { threadId } = useParams<{ threadId?: string }>();

  const threads = useQuery(api.threads.getAllThreads);
  const setThreads = useChatStore((state) => state.setThreads);

  const activeThread = threads?.find((thread) => thread._id === fromUUID(threadId));

  const localThreads = JSON.parse(
    localStorage.getItem(THREAD_LOCAL_STORAGE_KEY) ?? "[]",
  ) as typeof threads;
  const groupedThreads = groupByDate(threads ?? localThreads ?? []);

  useEffect(() => {
    if (threads) {
      localStorage.setItem(THREAD_LOCAL_STORAGE_KEY, JSON.stringify(threads));
      setThreads(threads);
    }
  }, [threads, setThreads]);

  return (
    <Sidebar variant="inset">
      <Head>
        <title>{activeThread ? `${activeThread.title} - ${DEFAULT_TITLE}` : DEFAULT_TITLE}</title>
      </Head>

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
