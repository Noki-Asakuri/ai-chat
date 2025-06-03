import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

import Link from "next/link";

import { useChatStore } from "@/lib/chat/store";
import { cn, toUUID } from "@/lib/utils";

export function ThreadList() {
  const threads = useQuery(api.threads.getAllThreads);
  const activeThreadId = useChatStore((state) => state.threadId);

  return (
    <div className="hidden flex-col gap-2 px-4 py-6 lg:flex">
      <Link href="/">
        <div className="hover:bg-primary/20 text-foreground rounded-md border px-3 py-1.5 text-center">
          <span className="line-clamp-1 w-full text-sm">Create new thread</span>
        </div>
      </Link>

      <hr />

      {threads?.map((thread) => (
        <Link
          href={`/chat/${toUUID(thread._id)}`}
          key={thread._id}
          title={thread.title}
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
