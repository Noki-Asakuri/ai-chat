import type { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ThreadItem } from "./thread-items";

type ThreadGroupProps = {
  group: Doc<"groups"> | null;
  threads: Doc<"threads">[];
};

export function ThreadGroup({ group, threads }: ThreadGroupProps) {
  const { setNodeRef } = useDroppable({ id: group?._id ?? "none" });

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg">
      <div className="border-b px-3 py-2.5">{group?.title ?? "Ungrouped"}</div>

      <div ref={setNodeRef} className="flex flex-col gap-1 transition-all duration-150">
        <SortableContext
          items={threads.map((thread) => thread._id)}
          strategy={verticalListSortingStrategy}
        >
          {threads.map(function renderItem(thread) {
            return <ThreadItem key={thread._id} thread={thread} />;
          })}
        </SortableContext>

        {threads.length === 0 && (
          <div className="px-0.5 py-1.5 text-muted-foreground text-sm">Drop here</div>
        )}
      </div>
    </div>
  );
}
