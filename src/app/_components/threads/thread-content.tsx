import { api } from "@/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";

import { Dialog } from "@base-ui-components/react/dialog";
import { useDeferredValue, useRef, useState } from "react";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

import { ThreadGroup } from "./thread-group";
import { ThreadItem } from "./thread-items";

import { useChatStore } from "@/lib/chat/store";

export function ThreadContents() {
  const [query, setQuery] = useState<string>("");
  const deferredQuery = useDeferredValue(query);

  return (
    <>
      <div className="mt-2 flex flex-col items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search threads..."
          aria-label="Search threads"
          className="h-8"
        />

        <CreateGroupButton />
      </div>

      <ThreadListWrapper query={deferredQuery} />
    </>
  );
}

function CreateGroupButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const createGroup = useMutation(api.functions.groups.createGroup);

  async function onCreate(): Promise<void> {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) return;

    await createGroup({ title: trimmedTitle });

    setOpen(false);
    setTitle("");
  }

  return (
    <>
      <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
        New Group
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-[opacity] duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />
          <Dialog.Popup className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-[min(96vw,28rem)] rounded-lg border bg-background p-6 shadow-lg transition-all duration-150 data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <div className="mb-2">
              <h2 className="font-semibold text-lg">Create group</h2>
              <p className="text-muted-foreground text-sm">Enter a group name.</p>
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

function ThreadListWrapper({ query }: { query: string }) {
  const { data } = useQuery(convexQuery(api.functions.groups.listGroups, {}));
  if (!data || data.length === 0) return null;

  return <ThreadList data={data} />;
}

function ThreadList({ data }: { data: (typeof api.functions.groups.listGroups)["_returnType"] }) {
  const activeDraggingThreadId = useChatStore((state) => state.activeDraggingThread);
  const setActiveDraggingThreadId = useChatStore((state) => state.setActiveDraggingThread);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8, delay: 100, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8, delay: 100, tolerance: 5 } }),
  );

  const moveThread = useMutation(api.functions.groups.moveThread);
  const lastMoveRef = useRef<{ overId: string | null; threadId: string | null }>({
    overId: null,
    threadId: null,
  });

  function handleDragStart(event: DragStartEvent) {
    console.debug("[Thread] Drag start", event.active.id);

    const thread = data.threads.find((thread) => thread._id === event.active.id);
    if (!thread) return;

    setActiveDraggingThreadId(thread);
  }

  function handleDragOver(event: DragOverEvent) {
    console.debug("[Thread] Drag over", event.over?.id);

    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Avoid redundant server calls while hovering the same target
    if (lastMoveRef.current.overId === overId && lastMoveRef.current.threadId === activeId) {
      return;
    }

    // Ignore self-over
    if (overId === activeId) return;

    const activeThread = data.threads.find((t) => t._id === activeId);
    if (!activeThread) return;

    // Determine destination group and optional beforeId
    const overThread = data.threads.find((t) => t._id === overId);

    if (overThread) {
      // Hovering a thread: move before this thread within its group
      lastMoveRef.current = { overId, threadId: activeId };
      void moveThread({
        threadId: activeThread._id,
        destination: {
          groupId: overThread.groupId ?? null,
          beforeId: overThread._id,
        },
      });
      return;
    }

    // Hovering a container
    if (overId === "none") {
      lastMoveRef.current = { overId, threadId: activeId };
      void moveThread({
        threadId: activeThread._id,
        destination: {
          groupId: null,
        },
      });
      return;
    }

    const targetGroup = data.groups.find((g) => g._id === overId);
    if (!targetGroup) return;

    lastMoveRef.current = { overId, threadId: activeId };
    void moveThread({
      threadId: activeThread._id,
      destination: {
        groupId: targetGroup._id,
      },
    });
  }

  function handleDragEnd(_: DragEndEvent) {
    console.debug("[Thread] Drag end");
    setActiveDraggingThreadId(null);
  }

  function handleDragCancel(_: DragCancelEvent) {
    console.debug("[Thread] Drag cancel");
    setActiveDraggingThreadId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ThreadGroup key="none" group={null} threads={data.groupedThreads.none.threads} />

      {data.groups.map(function renderContainer(group) {
        return (
          <ThreadGroup
            key={group._id}
            group={group}
            threads={data.groupedThreads[group._id]?.threads ?? []}
          />
        );
      })}

      <DragOverlay dropAnimation={null}>
        {activeDraggingThreadId ? <ThreadItem thread={activeDraggingThreadId} disabled /> : null}
      </DragOverlay>
    </DndContext>
  );
}
