import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

import { useMutation, useQuery } from "convex/react";

import { Dialog } from "@base-ui-components/react/dialog";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { useLocalStorage } from "@uidotdev/usehooks";

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
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

import { ThreadGroup } from "./thread-group";
import { ThreadItem } from "./thread-items";
import { UngroupedThreadGroup } from "./thread-ungrouped";

import { useChatStore } from "@/lib/chat/store";

export function ThreadContents() {
  return (
    <>
      <div className="mt-2 flex items-center gap-2 *:flex-1">
        <Button size="sm" variant="secondary" asChild>
          <NavLink to="/">New Chat</NavLink>
        </Button>
        <CreateGroupButton />
      </div>

      <hr className="border-sidebar-border" />
      <ThreadListWrapper />
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
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
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

const LOCAL_STORAGE_KEY = "local-threads-cache";
function ThreadListWrapper() {
  const [localData, setLocalData] = useLocalStorage<ListGroupData | null>(LOCAL_STORAGE_KEY);
  const data = useQuery(api.functions.groups.listGroups);

  useEffect(() => {
    if (data) setLocalData(data);
  }, [data]);

  if (data) return <ThreadList data={data} />;
  if (localData) return <ThreadList data={localData} />;

  return null;
}

type SortableData = {
  sortable: {
    containerId: `Sortable-${string}`;
    index: number;
    items: Array<Id<"threads">>;
  };
};
export type ActiveThreadData = SortableData & {
  type: "thread";
  threadId: Id<"threads">;
  belongsTo: Id<"groups"> | null;
};
export type ActiveGroupData = SortableData & {
  type: "group";
  groupId: Id<"groups"> | null;
  title: string;
};

type PendingDropThread = {
  type: "thread";
  index: number;
  toGroupId: Id<"groups"> | null;
};

type PendingDropGroup = {
  type: "group";
  index: number;
};

type PendingDrop = PendingDropThread | PendingDropGroup;

type GroupThreads = Record<
  Id<"groups"> | "none",
  { group: Doc<"groups"> | null; threads: Doc<"threads">[] }
>;

type Groups = Doc<"groups">[];

type ListGroupData = (typeof api.functions.groups.listGroups)["_returnType"];

type ThreadListProps = {
  data: ListGroupData;
};

function ThreadList({ data }: ThreadListProps) {
  const removeGroupId = useMutation(api.functions.groups.removeGroupId);
  const moveThreadToGroup = useMutation(api.functions.groups.moveThreadToGroup);
  const reorderThread = useMutation(api.functions.groups.reorderThreadWithinGroup);
  const moveGroupToIndex = useMutation(api.functions.groups.moveGroupToIndex);

  // Optimistic local state for grouped threads while dragging
  const snapshotRef = useRef<GroupThreads | null>(null);

  const [optimisticGroups, setOptimisticGroups] = useState<Groups | null>(null);
  const [optimisticGrouped, setOptimisticGrouped] = useState<GroupThreads | null>(null);

  const pendingDropRef = useRef<PendingDrop | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8, delay: 100, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8, delay: 100, tolerance: 5 } }),
  );

  const grouped = optimisticGrouped ?? data.groupedThreads;
  const groups = optimisticGroups ?? data.groups;

  function handleDragStart(event: DragStartEvent) {
    console.debug("[Thread] Drag start", event.active.id);

    snapshotRef.current = optimisticGrouped ?? data.groupedThreads;
    const activeData = event.active.data.current as ActiveThreadData | ActiveGroupData;

    switch (activeData.type) {
      case "thread": {
        const thread = data.threads.find((t) => t._id === activeData.threadId)!;
        useChatStore.getState().setActiveDraggingItem({ type: "thread", item: thread });
        break;
      }

      case "group": {
        const group = data.groups.find((g) => g._id === activeData.groupId)!;
        useChatStore.getState().setActiveDraggingItem({ type: "group", item: group });
        break;
      }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    console.debug("[Thread] Drag over", event.over?.id, event.active.data, event.over?.data);

    const activeId = event.active.id as Id<"threads">;
    const overId = event.over?.id as Id<"threads"> | Id<"groups"> | "none" | undefined;

    const activeData = event.active.data.current as ActiveThreadData | ActiveGroupData;
    const overData = event.over?.data.current as ActiveThreadData | ActiveGroupData;

    if (!overId || overId === activeId) return;

    // Build a mutable draft of grouped threads for optimistic updates
    const nextGrouped = structuredClone(optimisticGrouped ?? data.groupedThreads);
    let nextGroups = [...(optimisticGroups ?? data.groups)];

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
          type: "thread",
          toGroupId: overData.belongsTo,
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
          type: "thread",
          index: insertIndex,
          toGroupId: overData.belongsTo,
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
          index: 0,
          type: "thread",
          toGroupId: overData.groupId,
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

      if (
        activeData.type === "group" &&
        overData.type === "group" &&
        activeData.sortable.index !== overData.sortable.index
      ) {
        console.debug("[Dnd]: Re-order groups");
        pendingDropRef.current = {
          type: "group",
          index: overData.sortable.index,
        };

        const fromIdx = activeData.sortable.index;
        const toIdx = overData.sortable.index;
        nextGroups = arrayMove(nextGroups, fromIdx, toIdx);

        break reorderLogic;
      }
    }

    setOptimisticGrouped(nextGrouped);
    setOptimisticGroups(nextGroups);
  }

  async function handleDragEnd(event: DragEndEvent) {
    console.debug("[Thread] Drag end", event.active.id);

    try {
      const pending = pendingDropRef.current;
      if (!pending) return;

      const activeItems = pending.type === "group" ? data.groups : data.threads;
      const item = activeItems.find((t) => t._id === (event.active.id as Id<"groups" | "threads">));

      if (!item) return;

      console.log("[Dnd]: Reorder", pending, item);

      switch (true) {
        case pending.type === "thread" && "groupId" in item && pending.toGroupId === null: {
          await removeGroupId({ threadId: item._id });
          break;
        }

        case pending.type === "thread" && "groupId" in item && pending.toGroupId === item.groupId: {
          console.log("[Dnd]: Reorder within group");
          await reorderThread({ threadId: item._id, toIndex: pending.index });
          break;
        }

        case pending.type === "thread" && "groupId" in item && pending.toGroupId !== item.groupId: {
          console.log("[Dnd]: Move thread to group");
          await moveThreadToGroup({
            threadId: item._id,
            toGroupId: pending.toGroupId,
            toIndex: pending.index,
          });
          break;
        }

        case pending.type === "group": {
          console.log("[Dnd]: Move group");
          await moveGroupToIndex({ groupId: item._id as Id<"groups">, toIndex: pending.index });
          break;
        }
      }

      setOptimisticGrouped(null);
      setOptimisticGroups(null);
      useChatStore.getState().setActiveDraggingItem(null);
    } catch (error) {
      console.error("[Thread] Reorder failed", error);
      // Rollback
      if (snapshotRef.current) setOptimisticGrouped(snapshotRef.current);
      setOptimisticGroups(data.groups);
    } finally {
      pendingDropRef.current = null;
      snapshotRef.current = null;
    }
  }

  function handleDragCancel(_: DragCancelEvent) {
    console.debug("[Thread] Drag cancel");
    setOptimisticGrouped(null);
    setOptimisticGroups(null);
    useChatStore.getState().setActiveDraggingItem(null);

    pendingDropRef.current = null;
    snapshotRef.current = null;
  }

  return (
    <div
      data-slot="thread-dnd-container"
      className="custom-scroll flex flex-col overflow-y-auto pr-2.5"
      style={{ scrollbarGutter: "stable both-edges" }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={groups.map((g) => g._id)} strategy={verticalListSortingStrategy}>
          {groups.map(function renderContainer(group) {
            const key = group._id;
            const groupThreads = grouped[key]?.threads ?? [];

            return <ThreadGroup key={key} group={group} threads={groupThreads} />;
          })}
        </SortableContext>

        <UngroupedThreadGroup threads={grouped.none?.threads ?? []} hasGroups={groups.length > 0} />
        <ThreadDraggingOverlay />
      </DndContext>
    </div>
  );
}

function ThreadDraggingOverlay() {
  const activeDraggingItem = useChatStore((state) => state.activeDraggingItem);

  return (
    <DragOverlay modifiers={[restrictToFirstScrollableAncestor, restrictToVerticalAxis]}>
      {activeDraggingItem && activeDraggingItem.type === "thread" && (
        <ThreadItem thread={activeDraggingItem.item} disabled isOverlay />
      )}

      {activeDraggingItem && activeDraggingItem.type === "group" && (
        <ThreadGroup group={activeDraggingItem.item} threads={[]} disabled isOverlay />
      )}
    </DragOverlay>
  );
}
