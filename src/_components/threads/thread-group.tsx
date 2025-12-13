import type { Doc } from "@/convex/_generated/dataModel";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ChevronLeftIcon } from "lucide-react";
import { type ComponentPropsWithRef } from "react";

import { Collapsible } from "@base-ui/react/collapsible";

import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "../ui/sidebar";

import type { ActiveGroupData, ActiveThreadData } from "./thread-content";
import { ThreadGroupActions } from "./thread-group-actions";
import { ThreadItem } from "./thread-item";

import { cn } from "@/lib/utils";

type ThreadGroupProps = {
  group: Doc<"groups">;
  threads: Doc<"threads">[];
  disabled?: boolean;
  isOverlay?: boolean;
};

export function ThreadGroup({ group, threads, disabled, isOverlay }: ThreadGroupProps) {
  const {
    active,
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isSorting,
  } = useSortable({
    id: group?._id ?? "none",
    disabled,
    data: { type: "group", groupId: group?._id ?? null, title: group?.title ?? "Ungrouped" },
  });

  const activeData = active?.data.current as ActiveGroupData | ActiveThreadData;
  const isGroupSorting = activeData?.type === "group" && isSorting;

  const style: React.CSSProperties = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isGroupSorting && activeData.groupId === group?._id ? 0.5 : 1,
  };

  return (
    <Collapsible.Root
      key={group?._id}
      disabled={disabled}
      defaultOpen={!disabled}
      data-slot="thread-group-collapsible"
      data-group={group?._id}
      data-thread-count={threads.length}
      data-order={group?.order}
    >
      <SidebarGroup style={style} ref={setSortableRef} className="flex">
        <div className="flex items-center justify-between gap-2">
          <SidebarGroupLabel
            {...attributes}
            {...listeners}
            asChild
            className="font-semibold select-none"
          >
            <span>{group?.title}</span>
          </SidebarGroupLabel>

          <div className="flex items-center gap-2">
            <ThreadGroupActions group={group} />

            <Collapsible.Trigger className="group/trigger flex w-full items-center justify-between gap-2">
              <ChevronLeftIcon
                className={cn(
                  "size-4 transition-[rotate]",
                  !isGroupSorting && "group-data-panel-open/trigger:-rotate-90",
                  isGroupSorting && "cursor-grab",
                )}
              />
            </Collapsible.Trigger>
          </div>
        </div>

        <ThreadGroupDropzone
          group={group}
          threads={threads}
          isHidden={isOverlay || disabled || isGroupSorting}
        />
      </SidebarGroup>
    </Collapsible.Root>
  );
}

type ThreadGroupDropzoneProps = ComponentPropsWithRef<"div"> & {
  group: Doc<"groups"> | null;
  threads: Doc<"threads">[];
  isHidden?: boolean;
};

export function ThreadGroupDropzone(props: ThreadGroupDropzoneProps) {
  const { setNodeRef: setDropRef } = useDroppable({
    id: props.group?._id ?? "none",
    data: { type: "group", groupId: props.group?._id, title: props.group?.title },
  });

  if (props.isHidden) return null;

  return (
    <Collapsible.Panel
      ref={setDropRef}
      data-group={props.group?._id}
      data-slot="thread-group-dropzone"
    >
      <SidebarGroupContent className="flex flex-col gap-1">
        <SortableContext
          items={props.threads.map((thread) => thread._id)}
          strategy={verticalListSortingStrategy}
        >
          {props.threads.map(function renderItem(thread) {
            return <ThreadItem key={thread._id} thread={thread} />;
          })}
        </SortableContext>

        {props.threads.length === 0 && (
          <div className="px-1.5 py-1.5 text-sm text-muted-foreground">Drop here</div>
        )}
      </SidebarGroupContent>
    </Collapsible.Panel>
  );
}
