import { api } from "@/convex/_generated/api";

import { GitBranchIcon, PinIcon, PinOffIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ButtonWithTip } from "../ui/button";

import { useChatStore } from "@/lib/chat/store";
import { getConvexReactClient } from "@/lib/convex/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID } from "@/lib/utils";
import { ThreadDeleteDialog } from "./thread-delete-dialog";

const convexClient = getConvexReactClient();

export function ThreadItem({ thread }: { thread: Thread }) {
  const activeThreadId = useChatStore((state) => state.threadId);
  const router = useRouter();

  function pinThread(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    console.debug("[Thread] Pin thread", thread);

    void convexClient.mutation(api.threads.pinThread, {
      threadId: thread._id,
      pinned: !thread.pinned,
    });
  }

  function goToParentThread(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    router.push(`/chat/${toUUID(thread.branchedFrom!)}`);
  }

  return (
    <Link
      href={`/chat/${toUUID(thread._id)}`}
      title={thread.title}
      prefetch={false}
      className={cn(
        "group relative isolate flex overflow-hidden px-3 py-1.5",
        "text-sidebar-primary-foreground hover:bg-sidebar-primary/20 rounded-none border-l-2 border-transparent transition-colors",
        { "border-sidebar-ring bg-sidebar-primary/20": thread._id === activeThreadId },
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {thread.branchedFrom && (
          <ButtonWithTip
            variant="none"
            size="none"
            title="Go to parent thread"
            className=""
            onClick={goToParentThread}
          >
            <GitBranchIcon className="size-4 rotate-180" />
          </ButtonWithTip>
        )}
        <span className="line-clamp-1 text-sm">{thread.title}</span>
      </div>

      <div className="absolute top-0 -right-[91px] flex items-center transition-[right] group-hover:right-0">
        <div className="h-8 w-6 bg-gradient-to-r from-transparent to-[#200e3c]"></div>

        <div className="flex items-center gap-0.75 bg-[#200e3c]">
          <ButtonWithTip
            title={thread.pinned ? "Unpin Thread" : "Pin Thread"}
            variant="none"
            className="size-8"
            onClick={pinThread}
          >
            {thread.pinned ? <PinOffIcon size={10} /> : <PinIcon size={10} />}
          </ButtonWithTip>

          <ThreadDeleteDialog thread={thread} />
        </div>
      </div>
    </Link>
  );
}
