import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";

import { GitBranchIcon, Loader2Icon, PinIcon, PinOffIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router";

import { ButtonWithTip } from "../ui/button";
import { Input } from "../ui/input";
import { ThreadDeleteDialog } from "./thread-delete-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ThreadItem({ thread }: { thread: Thread }) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>(thread.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    // If the thread title updates externally, ensure local state reflects it when not editing
    if (!isEditing) {
      setTitle(thread.title);
    }
  }, [thread.title, isEditing]);

  async function goToParentThread(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    await navigate(`/threads/${toUUID(thread.branchedFrom!)}`);
  }

  function startEdit(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setTitle(thread.title);
    setIsEditing(true);
  }

  async function commitEdit() {
    const next = title.trim();
    if (next.length > 0 && next !== thread.title) {
      await convexClient.mutation(api.functions.threads.updateThreadTitle, {
        threadId: thread._id,
        title: next,
      });
    }
    setIsEditing(false);
  }

  function cancelEdit() {
    setIsEditing(false);
    setTitle(thread.title);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void commitEdit()}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        aria-label="Rename thread"
        className="h-6 py-1 text-sm"
      />
    );
  }

  return (
    <NavLink
      to={`/threads/${toUUID(thread._id)}`}
      title={thread.title}
      onDoubleClick={startEdit}
      onClick={(e) => {
        if (isEditing) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
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

      {!isEditing && <ThreadActions thread={thread} />}
    </NavLink>
  );
}

function ThreadActions({ thread }: { thread: Thread }) {
  function pinThread(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    console.debug("[Thread] Pin thread", thread);
    void convexClient.mutation(api.functions.threads.pinThread, {
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
