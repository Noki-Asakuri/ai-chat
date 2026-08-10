import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { ClientOnly, useNavigate, useParams } from "@tanstack/react-router";

import { Dialog } from "@base-ui/react/dialog";
import { useMutation } from "convex/react";
import { FolderIcon, FolderPlusIcon, Loader2Icon, SearchIcon, SquarePenIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState, useTransition } from "react";

import { Button, buttonVariants } from "../ui/button";
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
import { Input } from "../ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Kbd } from "../ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "../ui/select";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";

import { ThreadDeleteDialog } from "./thread-delete-dialog";
import { ThreadShareDialog } from "./thread-share-dialog";
import { UngroupedThreadGroup } from "./thread-ungrouped";

import { getConvexReactClient } from "@/lib/convex/client";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { threadDialogStoreActions, useThreadDialogStore } from "@/lib/store/thread-dialog-store";
import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";
import { cn, fromUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();
const UNGROUPED_SELECT_VALUE = "ungrouped";

export function ThreadContents() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ClientOnly fallback={<ThreadListSkeleton key="thread-list-skeleton" />}>
        <ThreadListWrapper />
      </ClientOnly>
    </div>
  );
}

function ThreadListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" role="status" aria-label="Loading conversations">
      <span className="sr-only">Loading conversations</span>

      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 px-2 pb-1.5">
          <Skeleton className="h-10 min-w-0 flex-1 bg-input/60" />
          <Skeleton className="size-10 shrink-0 bg-input/60" />
        </div>

        <div className="flex items-center gap-1.5 px-2 pb-2">
          <Skeleton className="h-10 min-w-0 flex-1 bg-input/60" />
          <Skeleton className="size-10 shrink-0 bg-input/60" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-2.5 pl-2">
          <ThreadSkeleton titleWidth="w-[82%]" />
          <ThreadSkeleton titleWidth="w-[46%]" />
          <ThreadSkeleton titleWidth="w-[74%]" />
          <ThreadSkeleton titleWidth="w-[42%]" />
          <ThreadSkeleton titleWidth="w-[84%]" />
          <ThreadSkeleton titleWidth="w-[76%]" />
          <ThreadSkeleton titleWidth="w-[68%]" />
          <ThreadSkeleton titleWidth="w-[88%]" />
          <ThreadSkeleton titleWidth="w-[54%]" />
        </div>
      </div>
    </div>
  );
}

function ThreadSkeleton({
  titleWidth,
}: {
  titleWidth:
    | "w-[42%]"
    | "w-[46%]"
    | "w-[54%]"
    | "w-[64%]"
    | "w-[68%]"
    | "w-[72%]"
    | "w-[74%]"
    | "w-[76%]"
    | "w-[82%]"
    | "w-[84%]"
    | "w-[88%]";
}) {
  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Skeleton className="size-3.5 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-10 shrink-0" />
      </div>
      <Skeleton className={cn("h-3.5", titleWidth)} />
    </div>
  );
}

function CreateGroupButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const createGroup = useMutation(api.functions.groups.createGroup);

  async function onCreate(): Promise<void> {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) return;

    const groupId = await createGroup({ title: trimmedTitle });
    threadStoreActions.setActiveGroupId(groupId);

    setOpen(false);
    setTitle("");
  }

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className="size-10"
        aria-label="Create group"
        title="Create group"
        onClick={() => setOpen(true)}
      >
        <FolderPlusIcon />
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="data-ending-style:opacity-0ata-[starting-style]:opacity-0 fixed inset-0 z-40 bg-black opacity-20 transition-opacity duration-150 dark:opacity-70" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(96vw,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-8 shadow-lg transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="mb-2">
              <h2 className="text-lg font-semibold">Create group</h2>
              <p className="text-sm text-muted-foreground">Enter a group name.</p>
            </div>

            <form
              className="mt-3 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void onCreate();
              }}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Group name"
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <Dialog.Close render={<Button variant="outline" className="h-9 w-28" />}>
                  <XIcon data-icon="inline-start" />
                  Cancel
                </Dialog.Close>

                <Button type="submit" className="h-9 w-28" disabled={title.trim().length === 0}>
                  <FolderPlusIcon data-icon="inline-start" />
                  Create
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function ThreadListWrapper() {
  const localCache = useThreadStore((state) => state.groupedThreads);
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const lastSyncedThreadIdRef = useRef<Id<"threads"> | null>(null);
  const routeThreadId = fromUUID<Id<"threads">>(params?.threadId);
  const markThreadViewed = useMutation(api.functions.threads.markThreadViewed);

  const { data } = useQuery({
    ...convexSessionQuery(api.functions.groups.listGroups),
    initialData: localCache,
  });

  useEffect(() => {
    if (!data) return;

    threadStoreActions.setGroupedThreads(data);

    if (routeThreadId && lastSyncedThreadIdRef.current !== routeThreadId) {
      const routeThread = data.threads.find((thread) => thread._id === routeThreadId);
      if (routeThread) {
        threadStoreActions.setActiveGroupId(routeThread.groupId);
        lastSyncedThreadIdRef.current = routeThreadId;
        return;
      }
    }

    const activeGroupId = useThreadStore.getState().activeGroupId;
    if (activeGroupId && !data.groups.some((group) => group._id === activeGroupId)) {
      threadStoreActions.setActiveGroupId(null);
    }
  }, [data, routeThreadId]);

  useEffect(() => {
    if (!data || !routeThreadId) return;

    const routeThread = data.threads.find((thread) => thread._id === routeThreadId);
    if (!routeThread || routeThread.status !== "complete") return;
    if (routeThread.lastViewedAt !== undefined && routeThread.lastViewedAt >= routeThread.updatedAt) return;

    void markThreadViewed({ threadId: routeThreadId }).catch((error: unknown) => {
      console.error("[Thread] Mark thread viewed error:", error);
    });
  }, [data, markThreadViewed, routeThreadId]);

  if (!data) {
    return <ThreadListSkeleton key="thread-list-skeleton" />;
  }

  return <ThreadList data={data} />;
}

type ListGroupData = (typeof api.functions.groups.listGroups)["_returnType"];

type ThreadListProps = {
  data: ListGroupData;
};

function ThreadList({ data }: ThreadListProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isSavingTitle, startSavingTitle] = useTransition();
  const activeDialog = useThreadDialogStore((state) => state.activeDialog);
  const dialogThread = useThreadDialogStore((state) => state.thread);
  const activeGroupId = useThreadStore((state) => state.activeGroupId);

  const activeGroup = data.groups.find((group) => group._id === activeGroupId);
  const activeThreads = data.groupedThreads[activeGroupId ?? "none"]?.threads ?? [];
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredThreads = normalizedSearchQuery
    ? activeThreads.filter((thread) => thread.title.toLocaleLowerCase().includes(normalizedSearchQuery))
    : activeThreads;

  const isEditDialogOpen = activeDialog === "edit" && dialogThread !== null;
  const isDeleteDialogOpen = activeDialog === "delete" && dialogThread !== null;
  const isShareDialogOpen = activeDialog === "share" && dialogThread !== null;

  useEffect(() => {
    if (activeDialog === "edit" && dialogThread) setEditTitle(dialogThread.title);
  }, [activeDialog, dialogThread]);

  function saveThreadTitle(): void {
    if (!dialogThread || activeDialog !== "edit") return;

    const title = editTitle.trim();
    if (!title || title === dialogThread.title) {
      threadDialogStoreActions.closeThreadDialog();
      return;
    }

    console.debug("[Thread] Update title", { threadId: dialogThread._id, title });
    startSavingTitle(async () => {
      await convexClient.mutation(api.functions.threads.updateThreadTitle, {
        threadId: dialogThread._id,
        title,
      });

      threadDialogStoreActions.closeThreadDialog();
    });
  }

  function selectGroup(value: string | null): void {
    if (value === UNGROUPED_SELECT_VALUE || value === null) {
      threadStoreActions.setActiveGroupId(null);
      return;
    }

    const group = data.groups.find((item) => item._id === value);
    if (group) threadStoreActions.setActiveGroupId(group._id);
  }

  async function createNewChat(groupId: Id<"groups"> | null): Promise<void> {
    threadStoreActions.setActiveGroupId(groupId);
    setNewChatOpen(false);
    await navigate({ to: "/" });
  }

  function handleNewChatShortcut(event: KeyboardEvent<HTMLDivElement>): void {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey) return;

    const shortcutNumber = Number(event.key);
    if (!Number.isInteger(shortcutNumber) || shortcutNumber < 1 || shortcutNumber > 9) return;

    if (shortcutNumber === 1) {
      event.preventDefault();
      void createNewChat(null);
      return;
    }

    const group = data.groups[shortcutNumber - 2];
    if (!group) return;

    event.preventDefault();
    void createNewChat(group._id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 px-2 pb-1.5">
        <InputGroup className="h-10 rounded-md border-transparent bg-input/30 shadow-none">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search threads in active group"
            className="font-mono text-sm placeholder:text-muted-foreground"
          />
        </InputGroup>

        <Button
          size="icon"
          variant="outline"
          className="size-10"
          aria-label="New chat"
          title="New chat"
          onClick={() => setNewChatOpen(true)}
        >
          <SquarePenIcon />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-2">
        <Select value={activeGroupId ?? UNGROUPED_SELECT_VALUE} onValueChange={selectGroup}>
          <SelectTrigger className="min-w-0 flex-1 rounded-md border-transparent bg-input/30 px-2.5 font-mono text-sm hover:bg-input/50 data-[size=default]:h-10">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{activeGroup?.title ?? "Ungrouped"}</span>
            </span>
          </SelectTrigger>

          <SelectContent align="start" className="rounded-md bg-card">
            <SelectGroup>
              <SelectItem value={UNGROUPED_SELECT_VALUE}>
                <FolderIcon className="size-4" />
                Ungrouped
              </SelectItem>

              {data.groups.map((group) => (
                <SelectItem key={group._id} value={group._id}>
                  <FolderIcon className="size-4" />
                  {group.title}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <CreateGroupButton />
      </div>

      <div
        data-slot="thread-list-container"
        className="custom-scroll flex min-h-0 flex-1 flex-col overflow-y-auto pr-2.5 pl-2"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        <UngroupedThreadGroup threads={filteredThreads} />
      </div>

      <CommandDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        title="Create new chat"
        description="Choose which group the new chat belongs to."
        className="h-[min(36rem,calc(100dvh-4rem))] rounded-lg sm:max-w-3xl"
      >
        <Command
          className="[&_[data-slot=command-input-wrapper]]:p-2 [&_[data-slot=command-input-wrapper]_svg]:size-5! [&_[data-slot=command-input]]:text-sm! [&_[data-slot=input-group]]:h-12!"
          onKeyDown={handleNewChatShortcut}
        >
          <CommandInput placeholder="Choose a group..." />
          <CommandList className="max-h-none flex-1">
            <CommandEmpty>No groups found.</CommandEmpty>
            <CommandGroup heading="Groups" className="px-2 py-2">
              <CommandItem
                value="Ungrouped"
                className="min-h-16 gap-3 rounded-md! px-3 py-3 text-sm"
                onSelect={() => {
                  void createNewChat(null);
                }}
              >
                <FolderIcon />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">Ungrouped</span>
                  <span className="truncate text-xs text-muted-foreground">Create without a group</span>
                </span>
                <CommandShortcut>Ctrl+1</CommandShortcut>
              </CommandItem>

              {data.groups.map((group, index) => (
                <CommandItem
                  key={group._id}
                  value={group.title}
                  className="min-h-16 gap-3 rounded-md! px-3 py-3 text-sm"
                  onSelect={() => {
                    void createNewChat(group._id);
                  }}
                >
                  <FolderIcon />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{group.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {data.groupedThreads[group._id]?.threads.length ?? 0} threads
                    </span>
                  </span>
                  {index < 8 && <CommandShortcut>Ctrl+{index + 2}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>

          <Separator />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Enter</Kbd>
              Select
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              Close
            </span>
          </div>
        </Command>
      </CommandDialog>

      {isEditDialogOpen && (
        <Dialog.Root
          open={true}
          onOpenChange={(open) => {
            if (!open) threadDialogStoreActions.closeThreadDialog();
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:opacity-70" />
            <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(96vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <div className="mb-2">
                <h2 className="text-lg font-semibold">Edit thread</h2>
                <p className="text-sm text-muted-foreground">Update the thread title.</p>
              </div>

              <form
                className="mt-3 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveThreadTitle();
                }}
              >
                <Input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  placeholder="Thread title"
                  autoFocus
                />

                <div className="flex justify-end gap-2">
                  <Dialog.Close className={cn(buttonVariants({ variant: "ghost" }))}>Cancel</Dialog.Close>

                  <button
                    type="submit"
                    className={cn(buttonVariants({ variant: "default" }))}
                    disabled={isSavingTitle || editTitle.trim().length === 0}
                  >
                    {isSavingTitle ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    Save
                  </button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {isDeleteDialogOpen && dialogThread && (
        <ThreadDeleteDialog
          threadId={dialogThread._id}
          title={dialogThread.title}
          open={true}
          onOpenChange={(open) => {
            if (!open) threadDialogStoreActions.closeThreadDialog();
          }}
        />
      )}

      {isShareDialogOpen && dialogThread && (
        <ThreadShareDialog
          threadId={dialogThread._id}
          threadTitle={dialogThread.title}
          open={true}
          onOpenChange={(open) => {
            if (!open) threadDialogStoreActions.closeThreadDialog();
          }}
        />
      )}
    </div>
  );
}
