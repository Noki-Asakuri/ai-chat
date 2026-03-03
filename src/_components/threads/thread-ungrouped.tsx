import type { Doc } from "@/convex/_generated/dataModel";

import { Collapsible } from "@base-ui/react/collapsible";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronLeftIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useDroppable } from "@dnd-kit/core";

import { SidebarGroup, SidebarGroupLabel } from "../ui/sidebar";

import { ThreadItem } from "./thread-item";

import {
  getUngroupedBucketKey,
  threadGroupUIStoreActions,
  useThreadGroupUIStore,
} from "@/lib/store/thread-group-ui-store";
import { groupByDate } from "@/lib/threads/group-by-date";

const OLDER_THREADS_ESTIMATED_ITEM_HEIGHT_PX = 36;
const OLDER_THREADS_OVERSCAN = 8;
const THREAD_DND_CONTAINER_SELECTOR = "[data-slot='thread-dnd-container']";
const THREAD_UNGROUPED_DROPZONE_SELECTOR = "[data-slot='thread-ungrouped-dropzone']";

function getThreadDndScrollElement(listElement: HTMLDivElement | null): HTMLDivElement | null {
  if (!listElement) return null;

  const scrollElement = listElement.closest(THREAD_DND_CONTAINER_SELECTOR);
  if (!(scrollElement instanceof HTMLDivElement)) return null;

  return scrollElement;
}

function computeScrollMargin(listElement: HTMLDivElement, scrollElement: HTMLDivElement): number {
  const listRect = listElement.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();

  return listRect.top - scrollRect.top + scrollElement.scrollTop;
}

function resolveVirtualizationElements(
  listElement: HTMLDivElement | null,
): { listElement: HTMLDivElement; scrollElement: HTMLDivElement } | null {
  if (!listElement) return null;

  const scrollElement = getThreadDndScrollElement(listElement);
  if (!scrollElement) return null;

  return { listElement, scrollElement };
}

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
  const persistedKey = getUngroupedBucketKey(groupKey);
  const isOpen = useThreadGroupUIStore((state) => state.isOpenByKey[persistedKey] ?? true);
  const isOlderGroup = title === "older";

  if (threads.length === 0) return null;
  const beautifyTitle = keyToTitle[title as keyof typeof keyToTitle];

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={(nextOpen) => threadGroupUIStoreActions.setGroupOpen(persistedKey, nextOpen)}
      data-slot={groupKey}
      data-threads-count={threads.length}
    >
      <SidebarGroup>
        <SidebarGroupLabel
          render={<Collapsible.Trigger />}
          className="group/trigger flex w-full items-center justify-between gap-2 py-1 text-sm text-muted-foreground"
        >
          <span>{beautifyTitle}</span>
          <ChevronLeftIcon className="size-4 transition-[rotate] group-data-panel-open/trigger:-rotate-90" />
        </SidebarGroupLabel>

        <Collapsible.Panel className="flex flex-col gap-1">
          {isOlderGroup ? (
            <VirtualizedOlderThreadList threads={threads} />
          ) : (
            threads.map(function renderItem(thread) {
              return <ThreadItem key={thread._id} thread={thread} />;
            })
          )}
        </Collapsible.Panel>
      </SidebarGroup>
    </Collapsible.Root>
  );
}

type VirtualizedOlderThreadListProps = {
  threads: Doc<"threads">[];
};

function VirtualizedOlderThreadList({ threads }: VirtualizedOlderThreadListProps) {
  const listElementRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const virtualizer = useVirtualizer({
    count: threads.length,
    getScrollElement: function getScrollElement() {
      return getThreadDndScrollElement(listElementRef.current);
    },
    estimateSize: () => OLDER_THREADS_ESTIMATED_ITEM_HEIGHT_PX,
    overscan: OLDER_THREADS_OVERSCAN,
    scrollMargin,
  });

  useEffect(
    function setupScrollMarginObserver() {
      const resolvedElements = resolveVirtualizationElements(listElementRef.current);
      if (!resolvedElements) return;

      const { listElement, scrollElement } = resolvedElements;

      function updateScrollMargin(): void {
        const nextScrollMargin = computeScrollMargin(listElement, scrollElement);
        setScrollMargin(function setIfChanged(previousScrollMargin) {
          if (Math.abs(previousScrollMargin - nextScrollMargin) < 1) {
            return previousScrollMargin;
          }

          return nextScrollMargin;
        });
      }

      updateScrollMargin();

      if (typeof ResizeObserver === "undefined") return;

      const resizeObserver = new ResizeObserver(function handleResize() {
        updateScrollMargin();
      });

      resizeObserver.observe(listElement);
      resizeObserver.observe(scrollElement);

      const ungroupedDropzone = listElement.closest(THREAD_UNGROUPED_DROPZONE_SELECTOR);
      if (ungroupedDropzone instanceof HTMLDivElement) {
        resizeObserver.observe(ungroupedDropzone);
      }

      return function cleanupObserver() {
        resizeObserver.disconnect();
      };
    },
    [threads.length],
  );

  const totalHeight = virtualizer.getTotalSize();

  return (
    <div
      ref={listElementRef}
      className="relative w-full"
      style={{ height: totalHeight }}
      data-slot="thread-older-virtual-list"
    >
      {virtualizer.getVirtualItems().map(function renderVirtualThread(item) {
        const thread = threads[item.index];
        if (!thread) return null;

        return (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={item.index}
            className="absolute top-0 left-0 w-full pb-1"
            style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
          >
            <ThreadItem thread={thread} />
          </div>
        );
      })}
    </div>
  );
}
