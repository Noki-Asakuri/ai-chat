import type { Doc } from "@/convex/_generated/dataModel";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ChevronLeftIcon } from "lucide-react";
import { useMemo, type ComponentPropsWithRef } from "react";

import { Collapsible } from "@base-ui-components/react/collapsible";

import { SidebarGroup, SidebarGroupLabel } from "../ui/sidebar";
import { ThreadItem } from "./thread-items";

import { cn } from "@/lib/utils";
import type { ActiveGroupData, ActiveThreadData } from "./thread-content";

export function UngroupedThreadGroup({ threads }: { threads: Doc<"threads">[] }) {
  return (
    <Collapsible.Root
      defaultOpen
      data-group="none"
      data-slot="thread-group-collapsible"
      data-thread-count={threads.length}
    >
      <SidebarGroup className="flex flex-col overflow-hidden rounded-lg">
        <SidebarGroupLabel asChild className="select-none font-semibold">
          <Collapsible.Trigger className="group/trigger flex w-full items-center justify-between gap-2">
            <span>Ungrouped</span>

            <ChevronLeftIcon className="group-data-[panel-open]/trigger:-rotate-90 size-4 transition-[rotate]" />
          </Collapsible.Trigger>
        </SidebarGroupLabel>

        <Collapsible.Panel>
          <ThreadGroupDropzone threads={threads} group={null} />
        </Collapsible.Panel>
      </SidebarGroup>
    </Collapsible.Root>
  );
}

type ThreadGroupProps = {
  group: Doc<"groups"> | null;
  threads: Doc<"threads">[];
  disabled?: boolean;
};

export function ThreadGroup({ group, threads, disabled }: ThreadGroupProps) {
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
      <SidebarGroup
        style={style}
        ref={setSortableRef}
        className="flex flex-col overflow-hidden rounded-lg"
      >
        <SidebarGroupLabel
          asChild
          {...attributes}
          {...listeners}
          className={cn("select-none font-semibold", isGroupSorting && "cursor-grab")}
        >
          <Collapsible.Trigger className="group/trigger flex w-full items-center justify-between gap-2">
            <span>{group?.title ?? "Ungrouped"}</span>

            <ChevronLeftIcon
              className={cn(
                "size-4 transition-[rotate]",
                !isGroupSorting && "group-data-[panel-open]/trigger:-rotate-90",
              )}
            />
          </Collapsible.Trigger>
        </SidebarGroupLabel>

        <Collapsible.Panel hidden={disabled || isGroupSorting}>
          <ThreadGroupDropzone threads={threads} disabled={disabled} group={group} />
        </Collapsible.Panel>
      </SidebarGroup>
    </Collapsible.Root>
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
