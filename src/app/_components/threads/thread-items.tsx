import { api } from "@/convex/_generated/api";

import { GitBranchIcon, Loader2Icon, PinIcon, PinOffIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router";

import { ButtonWithTip } from "../ui/button";
import { ThreadDeleteDialog } from "./thread-delete-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ThreadItem({ thread }: { thread: Thread }) {
  const navigate = useNavigate();

  async function goToParentThread(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    await navigate(`/chat/${toUUID(thread.branchedFrom!)}`);
  }

  return (
    <NavLink
      to={`/chat/${toUUID(thread._id)}`}
      title={thread.title}
      className={({ isActive }) =>
        cn(
          "group/thread relative isolate flex overflow-hidden rounded-md px-3 py-1.5",
          "text-sidebar-foreground transition-colors hover:bg-[#393939]",
          { "bg-[#393939]": isActive },
        )
      }
    >
      <div className="flex w-full items-center justify-center gap-2">
        <ButtonWithTip
          variant="none"
          onClick={goToParentThread}
          title="Go to parent thread"
          className="absolute top-0 left-0 size-8"
          hidden={!thread.branchedFrom}
        >
          <GitBranchIcon className="size-4 rotate-180" />
          <span className="sr-only">Go to parent thread</span>
        </ButtonWithTip>

        <div
          className={cn("flex w-full items-center justify-between", {
            "ml-4": thread.branchedFrom,
          })}
        >
          <span className="line-clamp-1 text-sm">{thread.title}</span>

          {thread.status && thread.status !== "complete" && (
            <div className="inline-block">
              <Loader2Icon className="size-4 animate-spin" />
              <span className="sr-only">Streaming...</span>
            </div>
          )}
        </div>
      </div>

      <ThreadActions thread={thread} />
    </NavLink>
  );
}

function ThreadActions({ thread }: { thread: Thread }) {
  function pinThread(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    console.debug("[Thread] Pin thread", thread);
    void convexClient.mutation(api.threads.pinThread, {
      threadId: thread._id,
      pinned: !thread.pinned,
    });
  }

  return (
    <div className="absolute top-0 -right-[91px] flex items-center transition-[right] group-hover/thread:right-0">
      <div className="pointer-events-none h-8 w-6 bg-gradient-to-r from-transparent to-[#393939]"></div>

      <div className="z-20 flex items-center gap-0.75 bg-[#393939]">
        <ButtonWithTip
          title={thread.pinned ? "Unpin Thread" : "Pin Thread"}
          variant="none"
          className="size-8"
          onClick={pinThread}
        >
          {thread.pinned ? <PinOffIcon size={10} /> : <PinIcon size={10} />}
          <span className="sr-only">{thread.pinned ? "Unpin Thread" : "Pin Thread"}</span>
        </ButtonWithTip>

        <ThreadDeleteDialog threadId={thread._id} title={thread.title} />
      </div>
    </div>
  );
}
