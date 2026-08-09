import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { ClientOnly, useNavigate, useParams } from "@tanstack/react-router";

import { Dialog } from "@base-ui/react/dialog";
import { useMutation } from "convex/react";
import { FolderIcon, FolderPlusIcon, Loader2Icon, SearchIcon, SquarePenIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "../ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { Input } from "../ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "../ui/select";
import { Skeleton } from "../ui/skeleton";

import { ThreadDeleteDialog } from "./thread-delete-dialog";
import { ThreadShareDialog } from "./thread-share-dialog";
import { UngroupedThreadGroup } from "./thread-ungrouped";

import { convexSessionQuery } from "@/lib/convex/helpers";
import {
  threadDialogStoreActions,
  useThreadDialogStore,
} from "@/lib/store/thread-dialog-store";
import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";
import { getConvexReactClient } from "@/lib/convex/client";
import { buttonVariants } from "../ui/button";
import { cn, fromUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();
const UNGROUPED_SELECT_VALUE = "ungrouped";

export function ThreadContents() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ClientOnly fallback={<Skeleton className="h-full w-full" key="thread-list-skeleton" />}>
        <ThreadListWrapper />
      </ClientOnly>
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
        aria-label="Create group"
        title="Create group"
        onClick={() => setOpen(true)}
      >
        <FolderPlusIcon />
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="data-ending-style:opacity-0ata-[starting-style]:opacity-0 fixed inset-0 z-40 bg-black opacity-20 transition-opacity duration-150 dark:opacity-70" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(96vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
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
                <Dialog.Close className="inline-flex h-8 items-center rounded-md border px-3 text-sm">
                  Cancel
                </Dialog.Close>

                <Button type="submit" size="sm" disabled={title.trim().length === 0}>
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

  if (!data) {
    return <Skeleton className="h-full w-full" key="thread-list-skeleton" />;
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 px-2 pb-1.5">
        <InputGroup className="rounded-md border-transparent bg-transparent shadow-none has-[[data-slot=input-group-control]:focus-visible]:bg-muted">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search threads"
            aria-label="Search threads in active group"
            className="font-mono text-sm placeholder:text-muted-foreground"
          />
        </InputGroup>

        <Button
          size="icon"
          variant="ghost"
          aria-label="New chat"
          title="New chat"
          onClick={() => setNewChatOpen(true)}
        >
          <SquarePenIcon />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-1">
        <Select value={activeGroupId ?? UNGROUPED_SELECT_VALUE} onValueChange={selectGroup}>
          <SelectTrigger className="min-w-0 flex-1 rounded-md border-transparent px-2 font-mono text-sm hover:bg-muted">
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
        className="custom-scroll flex min-h-0 flex-1 flex-col overflow-y-auto pr-2.5"
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
        <Command>
          <CommandInput placeholder="Choose a group..." />
          <CommandList className="max-h-none flex-1">
            <CommandEmpty>No groups found.</CommandEmpty>
            <CommandGroup heading="Groups">
              <CommandItem
                value="Ungrouped"
                onSelect={() => {
                  void createNewChat(null);
                }}
              >
                <FolderIcon />
                <span>Ungrouped</span>
              </CommandItem>

              {data.groups.map((group) => (
                <CommandItem
                  key={group._id}
                  value={group.title}
                  onSelect={() => {
                    void createNewChat(group._id);
                  }}
                >
                  <FolderIcon />
                  <span>{group.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
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
