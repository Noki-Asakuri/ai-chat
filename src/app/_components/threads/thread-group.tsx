import type { Doc } from "@/convex/_generated/dataModel";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useMemo, type ComponentPropsWithRef } from "react";

import { ThreadItem } from "./thread-items";

import { cn } from "@/lib/utils";

export function UngroupedThreadGroup({ threads }: { threads: Doc<"threads">[] }) {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg">
      <div className={"border-b border-b-sidebar-border px-2 py-1.5"}>Ungrouped</div>
      <ThreadGroupDropzone threads={threads} group={null} />
    </div>
  );
}

type ThreadGroupProps = {
  group: Doc<"groups"> | null;
  threads: Doc<"threads">[];
  disabled?: boolean;
};

export function ThreadGroup({ group, threads, disabled }: ThreadGroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group?._id ?? "none",
    disabled,
    data: { type: "group", groupId: group?._id ?? null, title: group?.title ?? "Ungrouped" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div style={style} ref={setSortableRef} className="flex flex-col overflow-hidden rounded-lg">
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", userSelect: "none", fontWeight: 600, marginBottom: 8 }}
        className={cn(
          "border-b border-b-sidebar-border px-2 py-1.5",
          disabled && "rounded-md border",
        )}
      >
        {group?.title ?? "Ungrouped"}
      </div>

      <ThreadGroupDropzone threads={threads} disabled={disabled} group={group} />
    </div>
  );
}

type ThreadGroupDropzoneProps = ComponentPropsWithRef<"div"> & {
  group: Doc<"groups"> | null;
  threads: Doc<"threads">[];
  disabled?: boolean;
};

function ThreadGroupDropzone(props: ThreadGroupDropzoneProps) {
  const { setNodeRef: setDropRef } = useDroppable({
    id: props.group?._id ?? "none",
    data: {
      type: "group",
      groupId: props.group?._id ?? null,
      title: props.group?.title ?? "Ungrouped",
    },
  });

  const sortedThreads = useMemo(
    () => [...props.threads].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [props.threads],
  );

  if (props.disabled) return null;

  return (
    <div ref={setDropRef} className="flex flex-col gap-1 transition-all duration-150">
      <SortableContext
        items={sortedThreads.map((thread) => thread._id)}
        strategy={verticalListSortingStrategy}
      >
        {sortedThreads.map(function renderItem(thread) {
          return <ThreadItem key={thread._id} thread={thread} />;
        })}
      </SortableContext>

      {sortedThreads.length === 0 && (
        <div className="px-1.5 py-1.5 text-muted-foreground text-sm">Drop here</div>
      )}
    </div>
  );
}
