import { SearchIcon } from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";

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

export function ThreadCommand({ sidebarState }: { sidebarState: "expanded" | "collapsed" }) {
  const threads = useChatStore((state) => state.threads);
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);
  const threadCommandOpen = useChatStore((state) => state.threadCommandOpen);

  const groupedThreads = groupByDate(threads ?? []);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setThreadCommandOpen(true)}
        className={cn("size-7", { hidden: sidebarState === "expanded" })}
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
  const router = useRouter();
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);

  if (threads.length === 0) return null;

  return (
    <CommandGroup heading={heading}>
      {threads.map((thread) => (
        <CommandItem
          key={"thread-cmd-group-" + thread._id}
          className="!p-0"
          onSelect={() => {
            router.push(`/chat/${toUUID(thread._id)}`);
            setThreadCommandOpen(false);
          }}
        >
          <Link
            className="px-2 py-1.5"
            onClick={() => setThreadCommandOpen(false)}
            href={`/chat/${toUUID(thread._id)}`}
          >
            {thread.title}
          </Link>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
