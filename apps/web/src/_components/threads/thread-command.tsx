import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
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

import { SETTINGS_NAVIGATION } from "../settings/settings-navigation";
import { Button } from "../ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPage,
  CommandShortcut,
  CommandStatus,
  createCommandController,
  fuzzyItemScore,
  rankItems,
} from "../ui/command";
import { Kbd, KbdGroup } from "../ui/kbd";

import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";
import { useThreadGroups } from "@/lib/threads/use-thread-groups";
import { useThreadPin } from "@/lib/threads/use-thread-pin";
import { fromUUID, toUUID } from "@/lib/utils";

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
  const pinThread = useThreadPin();
  const { data: threadGroups } = useThreadGroups();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  const thread = threadGroups?.threads.find((candidate) => candidate._id === fromUUID(params?.threadId));
  if (!params?.threadId) return null;

  function toggleThreadPin() {
    if (!thread) return;

    console.debug("[Thread] Pin thread", thread);
    void pinThread({
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

function closeThreadCommand() {
  threadStoreActions.setThreadCommandOpen(false);
}

const THREAD_VALUE_PREFIX = "thread:";
const GROUP_VALUE_PREFIX = "group:";
const GROUPS_PAGE = "groups";

export function ThreadCommandDialog() {
  const navigate = useNavigate();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const { data: threadGroups } = useThreadGroups();
  const groups = threadGroups?.groups ?? [];
  const activeGroupId = useThreadStore((state) => state.activeGroupId);
  const threadCommandOpen = useThreadStore((state) => state.threadCommandOpen);
  const activeGroupTitle = groups.find((group) => group._id === activeGroupId)?.title ?? "Ungrouped";

  const [command] = useState(() => createCommandController());
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const selectingGroup = pages.at(-1) === GROUPS_PAGE;
  const [debouncedQuery] = useDebouncedValue(query, { wait: 250 });

  const { data, isFetching } = useQuery({
    enabled: threadCommandOpen && !selectingGroup,
    ...convexQuery(api.functions.threads.getAllThreads, {
      query: debouncedQuery,
      limit: debouncedQuery.trim() ? 200 : 5,
    }),
  });

  const isLoading = !selectingGroup && (isFetching || debouncedQuery !== query);
  const visibleThreads = isLoading ? [] : (data ?? []);
  const threads = query.trim()
    ? visibleThreads
    : visibleThreads.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  async function createNewThread(groupId: Id<"groups"> | null) {
    threadStoreActions.setActiveGroupId(groupId);
    await navigate({ to: "/" });
    closeThreadCommand();
  }

  return (
    <CommandDialog
      open={threadCommandOpen}
      onOpenChange={threadStoreActions.setThreadCommandOpen}
      // Ctrl+K and the search button open it through the store, so reset once it has closed instead.
      onOpenChangeComplete={(open) => {
        if (open) return;
        setQuery("");
        setPages([]);
      }}
      title="Command palette"
      description="Create a thread, open settings, or search your threads."
      className="top-[12vh] mt-0 rounded-2xl sm:max-w-2xl"
    >
      <Command
        controller={command}
        query={query}
        onQueryChange={setQuery}
        pages={pages}
        onPagesChange={setPages}
        // Thread results are already filtered by the server; everything else matches fuzzily.
        filter={(item, search) => item.value.startsWith(THREAD_VALUE_PREFIX) || fuzzyItemScore(item, search)}
        status={isLoading ? "loading" : "idle"}
        loop
        className="rounded-2xl"
      >
        <CommandInput
          aria-label={selectingGroup ? "Search groups" : "Search commands and threads"}
          placeholder={selectingGroup ? "Search groups..." : "Search commands and threads..."}
          wrapperClassName="h-16 border-b px-4"
          className="text-sm"
        />

        <CommandList className="max-h-[min(55dvh,28rem)] px-2 pb-2 [&_[data-slot=command-group-label]]:px-3 [&_[data-slot=command-group-label]]:pt-4 [&_[data-slot=command-item]]:min-h-10 [&_[data-slot=command-item]]:px-3 [&_[data-slot=command-item]]:text-sm">
          <CommandPage>
            <CommandGroup heading="Threads">
              <CommandItem
                value="new-thread"
                label={`New thread in ${activeGroupTitle}`}
                shortcut="mod+shift+o"
                onSelect={() => createNewThread(activeGroupId)}
              >
                <SquarePenIcon aria-hidden="true" />
                <span className="truncate">
                  New thread in <strong>{activeGroupTitle}</strong>
                </span>
                <CommandShortcut />
              </CommandItem>
              <CommandItem value="new-thread-in" label="New thread in…" page={GROUPS_PAGE}>
                <SquarePenIcon aria-hidden="true" />
                New thread in…
                <ChevronRightIcon aria-hidden="true" className="ml-auto text-muted-foreground" />
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Settings">
              {rankItems(SETTINGS_NAVIGATION, query, (item) => ({
                value: item.path,
                label: item.label,
                keywords: [item.description],
              })).map((item) => (
                <CommandItem
                  key={item.path}
                  value={item.path}
                  label={item.label}
                  keywords={[item.description]}
                  onSelect={async () => {
                    await navigate({ to: item.path, search: { rt: params?.threadId } });
                    closeThreadCommand();
                  }}
                >
                  <item.icon aria-hidden="true" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>

            {threads.length > 0 && (
              <CommandGroup heading={query.trim() ? "Search results" : "Recent threads"}>
                {threads.map((thread) => (
                  <CommandItem
                    key={thread._id}
                    value={`${THREAD_VALUE_PREFIX}${thread._id}`}
                    label={thread.title}
                    onSelect={async () => {
                      await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(thread._id) } });
                      closeThreadCommand();
                    }}
                  >
                    <span title={thread.title} className="w-full truncate">
                      {thread.title}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandPage>

          <CommandPage value={GROUPS_PAGE}>
            <CommandGroup heading="New thread in…">
              <CommandItem
                value={`${GROUP_VALUE_PREFIX}ungrouped`}
                label="Ungrouped"
                onSelect={() => createNewThread(null)}
              >
                <FolderIcon aria-hidden="true" />
                Ungrouped
              </CommandItem>
              {rankItems(groups, query, (group) => ({ value: group._id, label: group.title })).map(
                (group) => (
                  <CommandItem
                    key={group._id}
                    value={`${GROUP_VALUE_PREFIX}${group._id}`}
                    label={group.title}
                    onSelect={() => createNewThread(group._id)}
                  >
                    <FolderIcon aria-hidden="true" />
                    <span className="truncate">{group.title}</span>
                  </CommandItem>
                ),
              )}
            </CommandGroup>
            <CommandItem value="back" label="Back to threads" onSelect={() => command.pop()}>
              <ArrowLeftIcon aria-hidden="true" />
              Back to threads
            </CommandItem>
          </CommandPage>
        </CommandList>

        <CommandStatus>
          {(state) =>
            state.loading ? (
              <span className="flex w-full items-center justify-center gap-2">
                <LoaderIcon aria-hidden="true" className="size-4 animate-spin" />
                Fetching threads...
              </span>
            ) : (
              `${state.count} ${state.count === 1 ? "result" : "results"}`
            )
          }
        </CommandStatus>
        <CommandEmpty>No results found.</CommandEmpty>

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
