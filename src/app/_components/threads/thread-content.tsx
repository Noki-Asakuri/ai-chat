import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";

import { Dialog } from "@base-ui-components/react/dialog";
import { useDeferredValue, useEffect, useRef, useState } from "react";

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
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove } from "@dnd-kit/sortable";

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
  if (!data || data.threads.length === 0) return null;

  return <ThreadList data={data} />;
}

type SortableData = {
  sortable: {
    containerId: `Sortable-${string}`;
    index: number;
    items: Array<Id<"threads">>;
  };
};
type ActiveThreadData = SortableData & {
  type: "thread";
  threadId: Id<"threads">;
  belongsTo: Id<"groups"> | null;
};
type ActiveGroupData = SortableData & {
  type: "group";
  groupId: Id<"groups"> | null;
  title: string;
};

type PendingDrop = {
  toGroupId: Id<"groups"> | null;
  index: number;
  kind: "moving-thread" | "re-ordering-thread";
  metadata?: Record<string, unknown>;
};

function ThreadList({ data }: { data: (typeof api.functions.groups.listGroups)["_returnType"] }) {
  const activeDraggingThread = useChatStore((state) => state.activeDraggingThread);
  const setActiveDraggingThreadId = useChatStore((state) => state.setActiveDraggingThread);

  const reorderThread = useMutation(api.functions.groups.reorderThreadWithinGroup);
  const moveThreadToGroup = useMutation(api.functions.groups.moveThreadToGroup);

  // Optimistic local state for grouped threads while dragging
  const [optimisticGrouped, setOptimisticGrouped] = useState<typeof data.groupedThreads | null>(
    null,
  );
  const snapshotRef = useRef<typeof data.groupedThreads | null>(null);
  const pendingDropRef = useRef<PendingDrop | null>(null);
  const commitAwaitRef = useRef<{
    threadId: Id<"threads">;
    toGroupId: Id<"groups"> | null;
    toIndex: number;
  } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8, delay: 100, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8, delay: 100, tolerance: 5 } }),
  );

  const grouped = optimisticGrouped ?? data.groupedThreads;

  function handleDragStart(event: DragStartEvent) {
    console.debug("[Thread] Drag start", event.active.id);
    const thread = data.threads.find((t) => t._id === event.active.id);
    if (!thread) return;

    snapshotRef.current = optimisticGrouped ?? data.groupedThreads;
    setActiveDraggingThreadId(thread);
  }

  function handleDragOver(event: DragOverEvent) {
    const activeId = event.active.id as Id<"threads">;
    const overId = event.over?.id as Id<"threads"> | Id<"groups"> | "none" | undefined;
    if (!overId || overId === activeId) return;

    const activeData = event.active.data.current as ActiveThreadData | ActiveGroupData;
    const overData = event.over?.data.current as ActiveThreadData | ActiveGroupData;

    // Build a mutable draft of grouped threads for optimistic updates
    const nextGrouped = structuredClone(optimisticGrouped ?? data.groupedThreads);

    const keyOf = (gid: Id<"groups"> | null): Id<"groups"> | "none" => gid ?? "none";

    const ensureContainer = (key: Id<"groups"> | "none") => {
      if (!nextGrouped[key]) {
        const groupObj = key === "none" ? null : (data.groups.find((g) => g._id === key) ?? null);
        nextGrouped[key] = { group: groupObj, threads: [] };
      }
      return nextGrouped[key];
    };

    reorderLogic: {
      // Re-order within the same group
      if (
        activeData.type === "thread" &&
        overData.type === "thread" &&
        activeData.belongsTo === overData.belongsTo
      ) {
        console.debug("[Dnd]: Re-order within the same group");
        pendingDropRef.current = {
          kind: "re-ordering-thread",
          toGroupId: activeData.belongsTo,
          index: overData.sortable.index,
        };

        const key = keyOf(activeData.belongsTo);
        const container = ensureContainer(key);

        const fromIdx = container.threads.findIndex((t) => t._id === activeId);
        if (fromIdx === -1) break reorderLogic;

        const toIdx = overData.sortable.index;
        container.threads = arrayMove(container.threads, fromIdx, toIdx);
        container.threads = container.threads.map((t, i) => ({ ...t, order: i }));

        break reorderLogic;
      }

      // Moving to a different group while dragging over a thread
      if (
        activeData.type === "thread" &&
        overData.type === "thread" &&
        activeData.belongsTo !== overData.belongsTo
      ) {
        console.debug("[Dnd]: Moving to a different group (over thread)");

        const fromKey = keyOf(activeData.belongsTo);
        const toKey = keyOf(overData.belongsTo);

        const fromContainer = ensureContainer(fromKey);
        const toContainer = ensureContainer(toKey);

        const fromIdx = fromContainer.threads.findIndex((t) => t._id === activeId);
        if (fromIdx === -1) break reorderLogic;

        // If hovering the last item in the target, treat as append-to-end.
        const baseIndex = overData.sortable.index;
        const insertIndex =
          toContainer.threads.length === 0
            ? 0
            : baseIndex >= toContainer.threads.length - 1
              ? toContainer.threads.length
              : baseIndex;

        pendingDropRef.current = {
          kind: "moving-thread",
          toGroupId: overData.belongsTo,
          index: insertIndex,
          metadata: { type: "thread" },
        };

        const [moved] = fromContainer.threads.splice(fromIdx, 1);
        const movedUpdated = { ...moved, groupId: toKey === "none" ? null : toKey };
        toContainer.threads.splice(insertIndex, 0, movedUpdated as Doc<"threads">);

        fromContainer.threads = fromContainer.threads.map((t, i) => ({ ...t, order: i }));
        toContainer.threads = toContainer.threads.map((t, i) => ({ ...t, order: i }));

        break reorderLogic;
      }

      // Moving to a different group while dragging over a group container
      if (
        activeData.type === "thread" &&
        overData.type === "group" &&
        activeData.belongsTo !== overData.groupId
      ) {
        console.debug("[Dnd]: Moving to a different group (over container)");
        pendingDropRef.current = {
          kind: "moving-thread",
          toGroupId: overData.groupId,
          index: 0,
          metadata: { type: "group" },
        };

        const fromKey = keyOf(activeData.belongsTo);
        const toKey = keyOf(overData.groupId ?? null);

        const fromContainer = ensureContainer(fromKey);
        const toContainer = ensureContainer(toKey);

        const fromIdx = fromContainer.threads.findIndex((t) => t._id === activeId);
        if (fromIdx === -1) break reorderLogic;

        const [moved] = fromContainer.threads.splice(fromIdx, 1);
        const movedUpdated = { ...moved, groupId: toKey === "none" ? null : toKey };
        toContainer.threads.splice(0, 0, movedUpdated as Doc<"threads">);

        fromContainer.threads = fromContainer.threads.map((t, i) => ({ ...t, order: i }));
        toContainer.threads = toContainer.threads.map((t, i) => ({ ...t, order: i }));

        break reorderLogic;
      }
    }

    setOptimisticGrouped(nextGrouped);
  }

  async function handleDragEnd(event: DragEndEvent) {
    try {
      const activeId = event.active.id as Id<"threads">;
      const pending = pendingDropRef.current;
      if (!pending) return;

      console.log("[Dnd]: Reorder", pending, activeId);

      switch (pending.kind) {
        case "re-ordering-thread": {
          await reorderThread({ threadId: activeId, toIndex: pending.index });
          break;
        }

        case "moving-thread": {
          await moveThreadToGroup({
            threadId: activeId,
            toGroupId: pending.toGroupId,
            toIndex: pending.index,
          });
          break;
        }
      }

      // Success: defer clearing optimistic state until server reflects it
      commitAwaitRef.current = {
        threadId: activeId,
        toGroupId: pending.toGroupId,
        toIndex: pending.index,
      };
      setActiveDraggingThreadId(null);
    } catch (error) {
      console.error("[Thread] Reorder failed", error);
      // Rollback
      if (snapshotRef.current) {
        setOptimisticGrouped(snapshotRef.current);
      }
    } finally {
      pendingDropRef.current = null;
      snapshotRef.current = null;
    }
  }

  function handleDragCancel(_: DragCancelEvent) {
    console.debug("[Thread] Drag cancel");
    setOptimisticGrouped(null);
    setActiveDraggingThreadId(null);
    pendingDropRef.current = null;
    snapshotRef.current = null;
    commitAwaitRef.current = null;
  }

  // Wait for live data to reflect the committed reorder/move, then clear optimistic state
  useEffect(() => {
    const pending = commitAwaitRef.current;
    if (!pending) return;

    const key = pending.toGroupId ?? "none";
    const container = data.groupedThreads[key];
    if (!container) return;

    const idx = container.threads.findIndex((t) => t._id === pending.threadId);
    if (idx === pending.toIndex) {
      setOptimisticGrouped(null);
      commitAwaitRef.current = null;
    }
  }, [data.groupedThreads]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ThreadGroup key="none" group={null} threads={grouped.none?.threads ?? []} />

      {data.groups.map(function renderContainer(group) {
        const key = group._id;
        const groupThreads = grouped[key]?.threads ?? [];
        return <ThreadGroup key={key} group={group} threads={groupThreads} />;
      })}

      <DragOverlay modifiers={[restrictToFirstScrollableAncestor, restrictToVerticalAxis]}>
        {activeDraggingThread ? <ThreadItem thread={activeDraggingThread} disabled /> : null}
      </DragOverlay>
    </DndContext>
  );
}
