import { SearchIcon } from "lucide-react";

import { NavLink, useNavigate } from "react-router";

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
import { cn, toUUID } from "@/lib/utils";

export function ThreadCommand() {
  const threads = useChatStore((state) => state.threads);
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);
  const threadCommandOpen = useChatStore((state) => state.threadCommandOpen);

  const groupedThreads = groupByDate(threads ?? []);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        title="Search Threads"
        onClick={() => setThreadCommandOpen(true)}
        className={cn("size-7 group-data-[state=expanded]:hidden")}
      >
        <SearchIcon />
        <span className="sr-only">Search Threads</span>
      </Button>

      <CommandDialog open={threadCommandOpen} onOpenChange={setThreadCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList className="custom-scroll">
          <CommandEmpty>No results found.</CommandEmpty>

          <ThreadCommandGroup heading="Pinned" threads={groupedThreads.pinned} />
          <ThreadCommandGroup heading="Today" threads={groupedThreads.today} />
          <ThreadCommandGroup heading="Yesterday" threads={groupedThreads.yesterday} />
          <ThreadCommandGroup heading="Last 7 days" threads={groupedThreads.sevenDaysAgo} />
          <ThreadCommandGroup heading="Older" threads={groupedThreads.older} />
        </CommandList>
      </CommandDialog>
    </>
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
          className="!p-0"
          onSelect={() => {
            void navigate(`/threads/${toUUID(thread._id)}`);
            setThreadCommandOpen(false);
          }}
        >
          <NavLink
            className="px-2 py-1.5"
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
