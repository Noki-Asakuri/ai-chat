"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache";

import { useUser } from "@clerk/nextjs";
import { useDocumentTitle } from "@uidotdev/usehooks";
import Link from "next/link";
import { useEffect } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

import { useChatStore } from "@/lib/chat/store";
import { cn, toUUID } from "@/lib/utils";

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
  const setThreads = useChatStore((state) => state.setThreads);

  const localThreads = JSON.parse(localStorage.getItem(THREAD_LOCAL_STORAGE_KEY) ?? "[]") as typeof threads;
  const groupedThreads = groupThreadsByDate(threads ?? localThreads ?? []);

  useEffect(() => {
    if (threads) {
      localStorage.setItem(THREAD_LOCAL_STORAGE_KEY, JSON.stringify(threads));
      setThreads(threads);
    }
  }, [threads]);

  return (
    <div className="hidden h-full grid-cols-1 grid-rows-[1fr_max-content] gap-y-3 py-4 lg:grid">
      <div className="flex flex-col gap-3 px-4">
        <Link href="/">
          <div className="hover:bg-primary/20 text-foreground rounded-md border px-3 py-1.5 text-center">
            <span className="line-clamp-1 w-full text-sm">Create new thread</span>
          </div>
        </Link>

        <hr />

        <ThreadGroup threads={groupedThreads.today} title="Today" />
        <ThreadGroup threads={groupedThreads.yesterday} title="Yesterday" />
        <ThreadGroup threads={groupedThreads.sevenDaysAgo} title="Last 7 days" />
        <ThreadGroup threads={groupedThreads.older} title="Older" />
      </div>

      <UserProfile />
    </div>
  );
}

function UserProfile() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded || !isSignedIn) return null;

  const fallback = user.username
    ?.split(" ")
    .map((name) => name[0])
    .join("");

  return (
    <div className="mt-auto flex flex-col">
      <hr className="mb-4" />

      <Link
        prefetch={false}
        href="/auth/settings"
        className="hover:bg-primary/20 hover:border-primary/30 mx-4 flex gap-2 rounded-md border border-transparent p-2 transition-colors"
      >
        <Avatar className="size-11 rounded-md">
          <AvatarImage src={user.imageUrl} alt={user.username!} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">{fallback}</AvatarFallback>
        </Avatar>

        <div className="ml-1 flex flex-col justify-center">
          <p className="text-sm font-medium capitalize">{user.username}</p>
          <p className="text-muted-foreground text-sm">Settings</p>
        </div>
      </Link>
    </div>
  );
}

const DEFAULT_TITLE = "AI Chat";
function ThreadGroup({ title, threads }: { title: string; threads: Thread[] }) {
  if (!threads.length) return null;
  const activeThreadId = useChatStore((state) => state.threadId);

  const documentTitle = threads.find((thread) => thread._id === activeThreadId)?.title;
  useDocumentTitle(documentTitle ? `${documentTitle} - ${DEFAULT_TITLE}` : DEFAULT_TITLE);

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
