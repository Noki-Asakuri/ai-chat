import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [open, setOpen] = useState(false);
  const threads = useChatStore((state) => state.threads);

  const groupedThreads = groupByDate(threads ?? []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={cn("size-7", { hidden: sidebarState === "expanded" })}
      >
        <SearchIcon />
        <span className="sr-only">Search Threads</span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList className="custom-scroll">
          <CommandEmpty>No results found.</CommandEmpty>

          <ThreadCommandGroup setOpen={setOpen} heading="Pinned" threads={groupedThreads.pinned} />
          <ThreadCommandGroup setOpen={setOpen} heading="Today" threads={groupedThreads.today} />
          <ThreadCommandGroup
            setOpen={setOpen}
            heading="Yesterday"
            threads={groupedThreads.yesterday}
          />
          <ThreadCommandGroup
            setOpen={setOpen}
            heading="Last 7 days"
            threads={groupedThreads.sevenDaysAgo}
          />
          <ThreadCommandGroup setOpen={setOpen} heading="Older" threads={groupedThreads.older} />
        </CommandList>
      </CommandDialog>
    </>
  );
}

type ThreadCommandGroupProps = {
  threads: Thread[];
  heading: string;
  setOpen: (open: boolean) => void;
};

function ThreadCommandGroup({ threads, heading, setOpen }: ThreadCommandGroupProps) {
  const router = useRouter();
  if (threads.length === 0) return null;

  return (
    <CommandGroup heading={heading}>
      {threads.map((thread) => (
        <CommandItem
          key={"thread-cmd-group-" + thread._id}
          className="!p-0"
          onSelect={() => {
            router.push(`/chat/${toUUID(thread._id)}`);
            setOpen(false);
          }}
        >
          <Link
            className="px-2 py-1.5"
            onClick={() => setOpen(false)}
            href={`/chat/${toUUID(thread._id)}`}
          >
            {thread.title}
          </Link>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
