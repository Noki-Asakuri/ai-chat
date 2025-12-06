import type { Doc } from "@/convex/_generated/dataModel";

import { Collapsible } from "@base-ui-components/react/collapsible";
import { ChevronLeftIcon } from "lucide-react";

import { useDroppable } from "@dnd-kit/core";

import { SidebarGroup, SidebarGroupLabel } from "../ui/sidebar";

import { ThreadItem } from "./thread-items";

import { groupByDate } from "@/lib/threads/group-by-date";

type UngroupedThreadGroupProps = {
  threads: Doc<"threads">[];
  hasGroups: boolean;
};

export function UngroupedThreadGroup({ threads, hasGroups }: UngroupedThreadGroupProps) {
  const { setNodeRef: setDropRef } = useDroppable({
    id: "none",
    data: { type: "group", groupId: null, title: "Ungrouped" },
  });

  const groupedThreads = groupByDate(threads);

  return (
    <div ref={setDropRef} data-slot="thread-ungrouped-dropzone">
      {hasGroups && <hr className="my-1.5 border-sidebar-border" />}

      {Object.entries(groupedThreads).map(function renderItem([title, threads]) {
        const groupKey = `thread-ungrouped-group-${title}`;
        return (
          <GroupByDateItem key={groupKey} groupKey={groupKey} title={title} threads={threads} />
        );
      })}
    </div>
  );
}

const keyToTitle = {
  pinned: "Pinned",
  today: "Today",
  yesterday: "Yesterday",
  sevenDaysAgo: "7 Days Ago",
  older: "Older",
};

type GroupByDateItemProps = {
  groupKey: string;
  title: string;
  threads: Doc<"threads">[];
};

function GroupByDateItem({ groupKey, title, threads }: GroupByDateItemProps) {
  if (threads.length === 0) return null;
  const beautifyTitle = keyToTitle[title as keyof typeof keyToTitle];

  return (
    <Collapsible.Root defaultOpen data-slot={groupKey} data-threads-count={threads.length}>
      <SidebarGroup>
        <SidebarGroupLabel asChild className="py-1 text-sm text-muted-foreground">
          <Collapsible.Trigger className="group/trigger flex w-full items-center justify-between gap-2">
            <span>{beautifyTitle}</span>

            <ChevronLeftIcon className="size-4 transition-[rotate] group-data-panel-open/trigger:-rotate-90" />
          </Collapsible.Trigger>
        </SidebarGroupLabel>

        <Collapsible.Panel className="flex flex-col gap-1">
          {threads.map(function renderItem(thread) {
            return <ThreadItem key={thread._id} thread={thread} />;
          })}
        </Collapsible.Panel>
      </SidebarGroup>
    </Collapsible.Root>
  );
}
