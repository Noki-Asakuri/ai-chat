"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache";

import Link from "next/link";
import { useDocumentTitle } from "@uidotdev/usehooks";

import { useChatStore } from "@/lib/chat/store";
import { cn, toUUID } from "@/lib/utils";
import { useEffect } from "react";

const THREAD_LOCAL_STORAGE_KEY = "threads";

type Thread = { _id: string; title: string; updatedAt: number };

function groupThreadsByDate(threads: Thread[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize 'now' to the start of today for comparison

  const today = new Date(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const groupedThreads = {
    today: [],
    yesterday: [],
    sevenDaysAgo: [], // This will represent "Within the last 7 days but not Today/Yesterday"
    older: [],
  } as {
    today: Thread[];
    yesterday: Thread[];
    sevenDaysAgo: Thread[];
    older: Thread[];
  };

  threads.forEach((thread) => {
    const threadUpdatedAt = new Date(thread.updatedAt);
    threadUpdatedAt.setHours(0, 0, 0, 0); // Normalize thread's date for comparison

    if (threadUpdatedAt.getTime() === today.getTime()) {
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

export function ThreadList() {
  const threads = useQuery(api.threads.getAllThreads);
  const activeThreadId = useChatStore((state) => state.threadId);

  const localThreads = JSON.parse(localStorage.getItem(THREAD_LOCAL_STORAGE_KEY) ?? "[]") as typeof threads;
  const groupedThreads = groupThreadsByDate(threads ?? localThreads ?? []);

  const title = threads?.find((thread) => thread._id === activeThreadId)?.title;
  useDocumentTitle(title ? `${title} - AI Chat` : "AI Chat");

  useEffect(() => {
    if (threads) {
      localStorage.setItem(THREAD_LOCAL_STORAGE_KEY, JSON.stringify(threads));
    }
  }, [threads]);

  return (
    <div className="hidden flex-col gap-2 px-4 py-6 lg:flex">
      <Link href="/">
        <div className="hover:bg-primary/20 text-foreground rounded-md border px-3 py-1.5 text-center">
          <span className="line-clamp-1 w-full text-sm">Create new thread</span>
        </div>
      </Link>

      <hr />

      <ThreadGroup threads={groupedThreads.today} title="Today" activeThreadId={activeThreadId} />
      <ThreadGroup threads={groupedThreads.yesterday} title="Yesterday" activeThreadId={activeThreadId} />
      <ThreadGroup threads={groupedThreads.sevenDaysAgo} title="Last 7 days" activeThreadId={activeThreadId} />
      <ThreadGroup threads={groupedThreads.older} title="Older" activeThreadId={activeThreadId} />
    </div>
  );
}

function ThreadGroup({
  title,
  threads,
  activeThreadId,
}: {
  title: string;
  threads: Thread[];
  activeThreadId?: string;
}) {
  if (!threads.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-primary px-2 text-sm font-semibold">{title}</h4>

      {threads.map((thread) => (
        <Link
          href={`/chat/${toUUID(thread._id)}`}
          key={thread._id}
          title={thread.title}
          prefetch={false}
          className={cn(
            "hover:bg-primary/20 text-foreground rounded-none border-l-2 border-transparent px-3 py-1.5 transition-colors",
            { "border-primary bg-primary/10 text-foreground": thread._id === activeThreadId },
          )}
        >
          <span className="line-clamp-1 w-full text-sm">{thread.title}</span>
        </Link>
      ))}
    </div>
  );
}
