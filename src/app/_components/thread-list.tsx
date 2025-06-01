import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

import { MessageCircleMoreIcon, MessageCirclePlusIcon } from "lucide-react";
import Link from "next/link";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ThreadList() {
  const threads = useQuery(api.threads.getAllThreads);
  const activeThreadId = useChatStore((state) => state.threadId);

  return (
    <div className="flex flex-col gap-2 px-4 py-6">
      {activeThreadId}

      <Link href="/">
        <div className="border-border bg-muted/80 rounded-md border px-4 py-2 transition-colors">
          <div className="flex items-center gap-2">
            <MessageCirclePlusIcon className="size-4" />
            <span className="line-clamp-1 text-sm">Create new thread</span>
          </div>
        </div>
      </Link>

      <hr />

      {threads?.map((thread) => (
        <Link
          href={`/chat/${thread.threadId}`}
          key={thread._id}
          className={cn(
            "border-border bg-muted/40 hover:bg-muted/80 text-muted-foreground/80 rounded-md border px-4 py-2 transition-colors",
            { "text-muted-foreground bg-muted/80 pointer-events-none": thread.threadId === activeThreadId },
          )}
        >
          <div className="flex items-center gap-1" title={thread.title}>
            <MessageCircleMoreIcon className="size-4" />
            <span className="line-clamp-1 w-full text-sm">{thread.title}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
