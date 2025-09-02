import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { CommandLoading } from "cmdk";
import { LoaderIcon, PinIcon, PinOffIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router";

import { Button } from "../ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";

import { useChatStore } from "@/lib/chat/store";
import { groupByDate } from "@/lib/threads/group-by-date";
import type { Thread } from "@/lib/types";
import { fromUUID, toUUID } from "@/lib/utils";
import { getConvexReactClient } from "@/lib/convex/client";

const convexClient = getConvexReactClient();

export function ThreadCommand() {
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);
  const threadCommandOpen = useChatStore((state) => state.threadCommandOpen);

  return (
    <div className="flex items-center justify-center gap-2">
      <PinThread />

      <Button
        variant="ghost"
        title="Search Threads"
        data-expanded={threadCommandOpen}
        onClick={() => setThreadCommandOpen(true)}
        className="h-7 rounded-md border px-2 py-1 opacity-100 transition-opacity data-[expanded=true]:opacity-0"
      >
        <SearchIcon />
        <span>Search Threads...</span>

        <kbd className="bg-muted text-muted-foreground pointer-events-none ml-8 inline-flex h-4 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <ThreadCommandDialog />
    </div>
  );
}

function PinThread() {
  const defaultThreads = useChatStore((state) => state.threads);
  const { threadId } = useParams<{ threadId: string }>();

  const thread = defaultThreads.find((thread) => thread._id === fromUUID(threadId));
  if (!threadId) return null;

  function toggleThreadPin() {
    if (!thread) return;

    console.debug("[Thread] Pin thread", thread);
    void convexClient.mutation(api.functions.threads.pinThread, {
      threadId: thread._id,
      pinned: !thread.pinned,
    });
  }

  return (
    <Button
      variant="ghost"
      title={thread?.pinned ? "Unpin Thread" : "Pin Thread"}
      className="h-7 w-7 cursor-pointer rounded-md border px-2 py-1"
      onClick={toggleThreadPin}
    >
      {thread?.pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
      <span className="sr-only">{thread?.pinned ? "Unpin Thread" : "Pin Thread"}</span>
    </Button>
  );
}

function ThreadCommandDialog() {
  const defaultThreads = useChatStore((state) => state.threads);
  const threadCommandOpen = useChatStore((state) => state.threadCommandOpen);
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 1000);

  const { data, isFetching } = useQuery({
    enabled: debouncedQuery.length > 0 && threadCommandOpen,
    placeholderData: defaultThreads,
    ...convexQuery(api.functions.threads.getAllThreads, { query: debouncedQuery }),
  });

  const isLoading = isFetching || debouncedQuery !== query;
  const groupedThreads = groupByDate(isLoading ? [] : (data ?? []));

  return (
    <CommandDialog open={threadCommandOpen} onOpenChange={setThreadCommandOpen}>
      <CommandInput placeholder="Search threads..." value={query} onValueChange={setQuery} />

      <CommandList className="custom-scroll max-h-[400px]">
        {isLoading && (
          <CommandLoading className="py-6 text-center text-sm">
            <div className="flex w-full items-center justify-center gap-2">
              <LoaderIcon className="size-4 animate-spin" />
              <span>Fetching threads...</span>
            </div>
          </CommandLoading>
        )}

        {!isLoading && (
          <>
            <CommandEmpty>No results found for "{query}".</CommandEmpty>

            <ThreadCommandGroup heading="Pinned" threads={groupedThreads.pinned} />
            <ThreadCommandGroup heading="Today" threads={groupedThreads.today} />
            <ThreadCommandGroup heading="Yesterday" threads={groupedThreads.yesterday} />
            <ThreadCommandGroup heading="Last 7 days" threads={groupedThreads.sevenDaysAgo} />
            <ThreadCommandGroup heading="Older" threads={groupedThreads.older} />
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

type ThreadCommandGroupProps = {
  threads: Thread[];
  heading: string;
};

function ThreadCommandGroup({ threads, heading }: ThreadCommandGroupProps) {
  const navigate = useNavigate();
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);

  if (threads.length === 0) return null;

  return (
    <CommandGroup heading={heading}>
      {threads.map((thread) => (
        <CommandItem
          key={"thread-cmd-group-" + thread._id}
          value={thread._id}
          className="!p-0"
          onSelect={async () => {
            await navigate(`/threads/${toUUID(thread._id)}`);
            setThreadCommandOpen(false);
          }}
        >
          <NavLink
            title={thread.title}
            className="w-full truncate px-2 py-1.5"
            onClick={() => setThreadCommandOpen(false)}
            to={{ pathname: `/threads/${toUUID(thread._id)}` }}
          >
            {thread.title}
          </NavLink>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
