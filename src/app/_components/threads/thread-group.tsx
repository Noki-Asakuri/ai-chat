import type { Doc } from "@/convex/_generated/dataModel";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { useMemo } from "react";

import { ThreadItem } from "./thread-items";

type ThreadGroupProps = {
  group: Doc<"groups"> | null;
  threads: Doc<"threads">[];
  disabled?: boolean;
};

export function ThreadGroup({ group, threads, disabled }: ThreadGroupProps) {
  const { setNodeRef } = useDroppable({
    disabled,
    id: group?._id ?? "none",
    data: { type: "group", groupId: group?._id ?? null, title: group?.title ?? "Ungrouped" },
  });

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [threads],
  );

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg">
      <div className="border-b px-3 py-2.5">{group?.title ?? "Ungrouped"}</div>

      {!disabled && (
        <div ref={setNodeRef} className="flex flex-col gap-1 transition-all duration-150">
          <SortableContext
            items={sortedThreads.map((thread) => thread._id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedThreads.map(function renderItem(thread) {
              return <ThreadItem key={thread._id} thread={thread} />;
            })}
          </SortableContext>

          {sortedThreads.length === 0 && (
            <div className="px-0.5 py-1.5 text-muted-foreground text-sm">Drop here</div>
          )}
        </div>
      )}
    </div>
  );
}
