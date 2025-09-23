import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

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
  const { data, refetch } = useQuery(convexQuery(api.functions.groups.listGroups, {}));
  if (!data || data.threads.length === 0) return null;

  return <ThreadList data={data} refresh={() => { void refetch(); }} />;
}

function ThreadList({
  data,
  refresh,
}: {
  data: (typeof api.functions.groups.listGroups)["_returnType"];
  refresh: () => void;
}) {
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

  type GroupKey = Id<"groups"> | "none";
  const [optimistic, setOptimistic] = useState<Record<GroupKey, Array<Doc<"threads">>> | null>(null);

  function snapshotFromData(): Record<GroupKey, Array<Doc<"threads">>> {
    const map: Record<GroupKey, Array<Doc<"threads">>> = {
      none: [...data.groupedThreads.none.threads],
    };
    for (const g of data.groups) {
      map[g._id] = [...(data.groupedThreads[g._id]?.threads ?? [])];
    }
    return map;
  }

  function findGroupKeyOf(
    map: Record<GroupKey, Array<Doc<"threads">>>,
    threadId: string,
  ): GroupKey | null {
    const entries = Object.entries(map) as Array<[GroupKey, Array<Doc<"threads">>]>;
    for (const [k, list] of entries) {
      if (list.some((t) => t._id === threadId)) return k;
    }
    return null;
  }

  function ensureOptimistic(): Record<GroupKey, Array<Doc<"threads">>> {
    if (optimistic) return optimistic;
    const snap = snapshotFromData();
    setOptimistic(snap);
    return snap;
  }

  function handleDragStart(event: DragStartEvent) {
    console.debug("[Thread] Drag start", event.active.id);
    const thread = data.threads.find((t) => t._id === event.active.id);
    if (!thread) return;
    setActiveDraggingThreadId(thread);
    // Take a snapshot for local reordering during drag
    setOptimistic(snapshotFromData());
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (overId === activeId) return;

    // Avoid redundant updates while hovering the same target
    if (lastMoveRef.current.overId === overId && lastMoveRef.current.threadId === activeId) return;

    const activeThread = data.threads.find((t) => t._id === activeId);
    if (!activeThread) return;

    const map = ensureOptimistic();

    const fromKey = findGroupKeyOf(map, activeId);
    if (!fromKey) return;

    const overIsThread = data.threads.some((t) => t._id === overId);

    // Create next map with cloned arrays to ensure state updates
    const next: Record<GroupKey, Array<Doc<"threads">>> = { ...map };
    const fromList = (map[fromKey] ?? []) as Array<Doc<"threads">>;
    next[fromKey] = fromList.filter((t) => t._id !== activeId);

    if (overIsThread) {
      const toKey =
        findGroupKeyOf(map, overId) ??
        ((data.threads.find((t) => t._id === overId)?.groupId ?? null) as Id<"groups"> | null) ??
        "none";
      const overListBase = toKey === fromKey ? next[toKey] : map[toKey];
      const overList = (overListBase ?? []) as Array<Doc<"threads">>;
      const idx = overList.findIndex((t) => t._id === overId);
      const insertAt = Math.max(0, idx);
      const activeDoc = activeThread;
      const newList = [...overList.slice(0, insertAt), activeDoc, ...overList.slice(insertAt)];
      next[toKey] = newList;
    } else {
      const containerKey: GroupKey = overId === "none" ? "none" : (overId as Id<"groups">);
      const baseList = containerKey === fromKey ? next[containerKey] : map[containerKey];
      const list = (baseList ?? []) as Array<Doc<"threads">>;
      next[containerKey] = [...list, activeThread];
    }

    lastMoveRef.current = { overId, threadId: activeId };
    setOptimistic(next);
  }

  async function handleDragEnd(event: DragEndEvent) {
    console.debug("[Thread] Drag end");
    const { active } = event;
    const activeId = String(active.id);

    const last = lastMoveRef.current;
    lastMoveRef.current = { overId: null, threadId: null };
    setActiveDraggingThreadId(null);

    if (!last.overId || last.threadId !== activeId) {
      setOptimistic(null);
      return;
    }

    const overId = last.overId;

    const overIsThread = data.threads.some((t) => t._id === overId);

    if (overIsThread) {
      const groupKey: GroupKey | null =
        (optimistic ? findGroupKeyOf(optimistic, overId) : null) ??
        ((data.threads.find((t) => t._id === overId)?.groupId ?? null) as Id<"groups"> | null) ??
        null;

      const destGroupId: Id<"groups"> | null =
        groupKey === "none" ? null : (groupKey as Id<"groups"> | null);

      await moveThread({
        threadId: activeId as Id<"threads">,
        destination: { groupId: destGroupId, beforeId: overId as Id<"threads"> },
      });
    } else if (overId === "none") {
      await moveThread({
        threadId: activeId as Id<"threads">,
        destination: { groupId: null },
      });
    } else {
      await moveThread({
        threadId: activeId as Id<"threads">,
        destination: { groupId: overId as Id<"groups"> },
      });
    }

    // Refresh server data and drop local optimistic state
    await Promise.resolve(refresh());
    setOptimistic(null);
  }

  function handleDragCancel(_: DragCancelEvent) {
    console.debug("[Thread] Drag cancel");
    lastMoveRef.current = { overId: null, threadId: null };
    setActiveDraggingThreadId(null);
    setOptimistic(null);
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
      <ThreadGroup
        key="none"
        group={null}
        threads={optimistic ? optimistic.none : data.groupedThreads.none.threads}
      />

      {data.groups.map(function renderContainer(group) {
        const key = group._id as Id<"groups">;
        const groupThreads =
          optimistic?.[key] ?? data.groupedThreads[key]?.threads ?? [];
        return <ThreadGroup key={group._id} group={group} threads={groupThreads} />;
      })}

      <DragOverlay dropAnimation={null}>
        {activeDraggingThreadId ? <ThreadItem thread={activeDraggingThreadId} disabled /> : null}
      </DragOverlay>
    </DndContext>
  );
}
