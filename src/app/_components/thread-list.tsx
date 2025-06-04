"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache";

import Link from "next/link";
import { useDocumentTitle } from "@uidotdev/usehooks";

import { useChatStore } from "@/lib/chat/store";
import { cn, toUUID } from "@/lib/utils";
import { useEffect } from "react";

const THREAD_LOCAL_STORAGE_KEY = "threads";

export function ThreadList() {
  const threads = useQuery(api.threads.getAllThreads);
  const activeThreadId = useChatStore((state) => state.threadId);

  const localThreads = JSON.parse(localStorage.getItem(THREAD_LOCAL_STORAGE_KEY) ?? "[]") as typeof threads;

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

      {(threads ?? localThreads)?.map((thread) => (
        <Link
          href={`/chat/${toUUID(thread._id)}`}
          key={thread._id}
          title={thread.title}
          prefetch={false}
          className={cn(
            "hover:bg-primary/20 text-foreground rounded-none border-l-2 border-transparent px-3 py-1.5 transition-colors",
            { "border-primary bg-primary/5 text-foreground": thread._id === activeThreadId },
          )}
        >
          <span className="line-clamp-1 w-full text-sm">{thread.title}</span>
        </Link>
      ))}
    </div>
  );
}
