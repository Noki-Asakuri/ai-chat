import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";

import { useDebounce } from "@uidotdev/usehooks";
import { CommandLoading } from "cmdk";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  LoaderIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  SquarePenIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import { SETTINGS_NAVIGATION } from "../settings/settings-navigation";
import { Kbd, KbdGroup } from "../ui/kbd";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "../ui/command";

import { getConvexReactClient } from "@/lib/convex/client";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";
import type { Thread } from "@/lib/types";
import { fromUUID, toUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ThreadCommand({ isSkeleton }: { isSkeleton?: boolean }) {
  const threadCommandOpen = useThreadStore((state) => state.threadCommandOpen);

  return (
    <div className="flex items-center justify-center gap-2">
      {!isSkeleton && <PinThread />}

      <Button
        variant="ghost"
        disabled={isSkeleton}
        title="Search Threads"
        data-expanded={threadCommandOpen}
        onClick={() => threadStoreActions.setThreadCommandOpen(true)}
        className="h-7 rounded-md border-border px-2 py-1 opacity-100 transition-[opacity,background-color]"
      >
        <SearchIcon />
        <span className="inline md:hidden">Search...</span>
        <span className="hidden md:inline">Search Threads...</span>

        <kbd className="text-3xs pointer-events-none ml-8 hidden h-4 items-center gap-1 rounded-md border bg-muted px-1.5 font-mono font-medium text-muted-foreground opacity-100 select-none md:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
    </div>
  );
}

function PinThread() {
  const defaultThreads = useThreadStore((state) => state.groupedThreads.threads);
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  const thread = defaultThreads.find((candidate) => candidate._id === fromUUID(params?.threadId));
  if (!params?.threadId) return null;

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
      className="size-7 cursor-pointer rounded-md border px-2 py-1"
      onClick={toggleThreadPin}
    >
      {thread?.pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
      <span className="sr-only">{thread?.pinned ? "Unpin Thread" : "Pin Thread"}</span>
    </Button>
  );
}

export function ThreadCommandDialog() {
  const navigate = useNavigate();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const groups = useThreadStore((state) => state.groupedThreads.groups);
  const activeGroupId = useThreadStore((state) => state.activeGroupId);
  const threadCommandOpen = useThreadStore((state) => state.threadCommandOpen);
  const activeGroupTitle = groups.find((group) => group._id === activeGroupId)?.title ?? "Ungrouped";

  const [query, setQuery] = useState("");
  const [selectingGroup, setSelectingGroup] = useState(false);
  const debouncedQuery = useDebounce(query, 250);

  const { data, isFetching } = useQuery({
    enabled: threadCommandOpen && !selectingGroup,
    ...convexSessionQuery(api.functions.threads.getAllThreads, {
      query: debouncedQuery,
      limit: debouncedQuery.trim() ? 200 : 5,
    }),
  });

  const isLoading = !selectingGroup && (isFetching || debouncedQuery !== query);
  const visibleThreads = isLoading ? [] : (data ?? []);
  const recentThreads = visibleThreads.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  async function createNewThread(groupId: Id<"groups"> | null) {
    threadStoreActions.setActiveGroupId(groupId);
    await navigate({ to: "/" });
    threadStoreActions.setThreadCommandOpen(false);
  }

  return (
    <CommandDialog
      open={threadCommandOpen}
      onOpenChange={threadStoreActions.setThreadCommandOpen}
      description="Create a thread, open settings, or search your threads."
      className="top-[12vh] translate-y-0 rounded-2xl sm:max-w-2xl"
    >
      <Command
        loop
        vimBindings={false}
        className="rounded-2xl [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-item]]:min-h-10 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:text-sm [&_[data-slot=command-input-wrapper]]:border-0 [&_[data-slot=input-group]]:h-16 [&_[data-slot=input-group]]:rounded-none [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input-group]]:px-4"
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            !event.altKey &&
            event.key.toLowerCase() === "o"
          ) {
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) void createNewThread(activeGroupId);
            return;
          }

          if (selectingGroup && (event.key === "Escape" || (event.key === "Backspace" && !query))) {
            event.preventDefault();
            event.stopPropagation();
            setSelectingGroup(false);
            setQuery("");
          }
        }}
      >
        <CommandInput
          aria-label={selectingGroup ? "Search groups" : "Search commands and threads"}
          placeholder={selectingGroup ? "Search groups..." : "Search commands and threads..."}
          value={query}
          onValueChange={setQuery}
          className="text-sm"
        />

        {selectingGroup && (
          <Button
            variant="ghost"
            className="mx-3 mb-1 w-fit"
            onClick={() => {
              setSelectingGroup(false);
              setQuery("");
            }}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Threads
          </Button>
        )}

        <CommandList className="max-h-[min(55dvh,28rem)] px-2 pb-2">
          {!isLoading && (selectingGroup || visibleThreads.length === 0) && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {selectingGroup ? (
            <CommandGroup heading="New thread in…">
              <CommandItem value="Ungrouped" onSelect={() => createNewThread(null)}>
                <FolderIcon />
                Ungrouped
              </CommandItem>
              {groups.map((group) => (
                <CommandItem
                  key={group._id}
                  value={group._id}
                  keywords={[group.title]}
                  onSelect={() => createNewThread(group._id)}
                >
                  <FolderIcon />
                  <span className="truncate">{group.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            <>
              <CommandGroup heading="Threads">
                <CommandItem
                  value={`New thread in ${activeGroupTitle}`}
                  onSelect={() => createNewThread(activeGroupId)}
                >
                  <SquarePenIcon />
                  <span className="truncate">
                    New thread in <strong>{activeGroupTitle}</strong>
                  </span>
                  <CommandShortcut>Ctrl+Shift+O</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="New thread in…"
                  onSelect={() => {
                    setSelectingGroup(true);
                    setQuery("");
                  }}
                >
                  <SquarePenIcon />
                  New thread in…
                  <CommandShortcut>
                    <ChevronRightIcon />
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>

              <CommandGroup heading="Settings">
                {SETTINGS_NAVIGATION.map((item) => (
                  <CommandItem
                    key={item.path}
                    value={item.path}
                    keywords={[item.label, item.description]}
                    onSelect={async () => {
                      await navigate({ to: item.path, search: { rt: params?.threadId } });
                      threadStoreActions.setThreadCommandOpen(false);
                    }}
                  >
                    <item.icon />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {!selectingGroup && isLoading && (
            <CommandLoading className="py-6 text-center text-sm">
              <div className="flex w-full items-center justify-center gap-2">
                <LoaderIcon className="size-4 animate-spin" />
                <span>Fetching threads...</span>
              </div>
            </CommandLoading>
          )}

          {!selectingGroup && !isLoading && (
            <ThreadCommandGroup
              heading={query.trim() ? "Search results" : "Recent threads"}
              threads={query.trim() ? visibleThreads : recentThreads}
            />
          )}
        </CommandList>
        <div className="flex flex-wrap items-center gap-4 border-t bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <KbdGroup>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
            </KbdGroup>{" "}
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd> Select
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd> {selectingGroup ? "Back" : "Close"}
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}

type ThreadCommandGroupProps = {
  threads: Thread[];
  heading: string;
};

function ThreadCommandGroup({ threads, heading }: ThreadCommandGroupProps) {
  const navigate = useNavigate();
  if (threads.length === 0) return null;

  return (
    <CommandGroup heading={heading} forceMount>
      {threads.map((thread) => (
        <CommandItem
          key={"thread-cmd-group-" + thread._id}
          value={thread._id}
          forceMount
          className="p-0!"
          onSelect={async () => {
            await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(thread._id) } });
            threadStoreActions.setThreadCommandOpen(false);
          }}
        >
          <span title={thread.title} className="w-full truncate px-2 py-1.5">
            {thread.title}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
