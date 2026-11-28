import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { Link } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDotIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderInputIcon,
  GitBranchIcon,
  Loader2Icon,
  PaperclipIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  Share2Icon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/ui/icons";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { UNGROUPED_COLOR } from "./group-colors";
import {
  LIBRARY_PAGE_SIZES,
  getPageItems,
  isFinished,
  toPageSize,
  isRunning,
  type LibraryGroup,
  type LibraryPage,
  type LibrarySearch,
  type LibrarySort,
  type LibraryThread,
} from "./library-search";

import { tryGetModelData } from "@/lib/chat/models";
import { cn, format, toUUID } from "@/lib/utils";

import type { GroupColor } from "./group-colors";

export type ThreadRowActions = {
  rename: (thread: LibraryThread) => void;
  share: (thread: LibraryThread) => void;
  remove: (thread: LibraryThread) => void;
  togglePin: (thread: LibraryThread) => Promise<void>;
  toggleSettled: (thread: LibraryThread) => Promise<void>;
  move: (thread: LibraryThread, groupId: Id<"groups"> | null) => Promise<void>;
  regenerateTitle: (thread: LibraryThread) => void;
};

type LibraryTableProps = {
  page: LibraryPage;
  total: number;
  search: LibrarySearch;
  groups: ReadonlyArray<LibraryGroup>;
  groupColors: ReadonlyMap<string, GroupColor>;
  now: number;
  selected: ReadonlySet<Id<"threads">>;
  actions: ThreadRowActions;
  emptyState: ReactNode;
  onToggleRow: (id: Id<"threads">) => void;
  onTogglePage: (checked: boolean) => void;
  onSortChange: (sort: LibrarySort, dir: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: LibrarySearch["size"]) => void;
};

// Text sorts read best A→Z first; numbers and dates read best biggest or newest first.
const ASCENDING_FIRST: ReadonlySet<LibrarySort> = new Set(["title", "group"]);

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function formatRelative(time: number, now: number): string {
  const seconds = Math.round((time - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relativeFormat.format(0, "second");
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relativeFormat.format(Math.round(seconds / 3600), "hour");
  if (abs < 86_400 * 7) return relativeFormat.format(Math.round(seconds / 86_400), "day");
  return format.date(time);
}

function RelativeTime({ time, now }: { time: number; now: number }) {
  return (
    <time dateTime={new Date(time).toISOString()} title={fullDate.format(time)} className="tabular-nums">
      {formatRelative(time, now)}
    </time>
  );
}

export function StatusPill({ thread }: { thread: LibraryThread }) {
  const base = "inline-flex h-5.5 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-medium whitespace-nowrap";

  if (isRunning(thread)) {
    return (
      <span className={cn(base, "bg-blue-500/12 text-blue-700 dark:text-blue-300")}>
        <Loader2Icon aria-hidden="true" className="size-3 animate-spin" />
        Running
      </span>
    );
  }
  if (thread.status === "error") {
    return (
      <span
        className={cn(base, "bg-destructive/10 text-destructive dark:bg-destructive/20")}
        title={thread.settled ? "Failed · Settled" : "Failed"}
      >
        <CircleAlertIcon aria-hidden="true" className="size-3" />
        Error
      </span>
    );
  }
  if (thread.settled) {
    return (
      <span className={cn(base, "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300")}>
        <CircleCheckIcon aria-hidden="true" className="size-3" />
        Settled
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-sky-500/12 text-sky-700 dark:text-sky-300")}>
      <CircleDotIcon aria-hidden="true" className="size-3" />
      Active
    </span>
  );
}

function GroupChip({ title, color }: { title: string; color: GroupColor }) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 max-w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 text-[0.6875rem] font-medium ring-1 ring-inset",
        color.chip,
      )}
      title={title}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", color.dot)} />
      <span className="truncate">{title}</span>
    </span>
  );
}

type SortHeaderProps = {
  sort: LibrarySort;
  label: string;
  search: LibrarySearch;
  align?: "start" | "end";
  className?: string;
  onSortChange: LibraryTableProps["onSortChange"];
};

function SortHeader({ sort, label, search, align = "start", className, onSortChange }: SortHeaderProps) {
  const active = search.sort === sort;
  const Icon = !active ? ChevronsUpDownIcon : search.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <th
      scope="col"
      aria-sort={active ? (search.dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("h-9 px-2 font-medium", align === "end" ? "text-right" : "text-left", className)}
    >
      <button
        type="button"
        onClick={() => {
          if (active) onSortChange(sort, search.dir === "asc" ? "desc" : "asc");
          else onSortChange(sort, ASCENDING_FIRST.has(sort) ? "asc" : "desc");
        }}
        className={cn(
          "-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          active && "text-foreground",
          align === "end" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon aria-hidden="true" className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </th>
  );
}

export function LibraryTable(props: LibraryTableProps) {
  const { page, search, groupColors, selected, now } = props;
  const groupTitles = new Map(props.groups.map((group) => [group._id, group.title]));
  const pageSelectedCount = page.rows.filter((row) => selected.has(row._id)).length;
  const allPageSelected = page.rows.length > 0 && pageSelectedCount === page.rows.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full table-fixed text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="h-9 w-10 pl-3">
                <Checkbox
                  aria-label="Select all threads on this page"
                  checked={allPageSelected}
                  indeterminate={pageSelectedCount > 0 && !allPageSelected}
                  disabled={page.rows.length === 0}
                  onCheckedChange={(checked) => props.onTogglePage(checked)}
                />
              </th>
              <SortHeader sort="title" label="Title" search={search} onSortChange={props.onSortChange} />
              <SortHeader
                sort="group"
                label="Group"
                search={search}
                className="hidden w-40 @3xl:table-cell"
                onSortChange={props.onSortChange}
              />
              <SortHeader
                sort="status"
                label="Status"
                search={search}
                className="hidden w-28 @xl:table-cell"
                onSortChange={props.onSortChange}
              />
              <SortHeader
                sort="messages"
                label="Messages"
                align="end"
                search={search}
                className="hidden w-26 @5xl:table-cell"
                onSortChange={props.onSortChange}
              />
              <SortHeader
                sort="attachments"
                label="Files"
                align="end"
                search={search}
                className="hidden w-18 @5xl:table-cell"
                onSortChange={props.onSortChange}
              />
              <SortHeader
                sort="updated"
                label="Updated"
                search={search}
                className="hidden w-28 pl-4 @3xl:table-cell"
                onSortChange={props.onSortChange}
              />
              <SortHeader
                sort="created"
                label="Created"
                search={search}
                className="hidden w-30 @6xl:table-cell"
                onSortChange={props.onSortChange}
              />
              <th scope="col" className="h-9 w-12">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {page.rows.length === 0 ? (
              <tr>
                <td colSpan={9}>{props.emptyState}</td>
              </tr>
            ) : (
              page.rows.map((thread) => {
                const groupTitle = thread.groupId === null ? null : (groupTitles.get(thread.groupId) ?? null);
                const groupColor =
                  thread.groupId === null ? UNGROUPED_COLOR : (groupColors.get(thread.groupId) ?? UNGROUPED_COLOR);

                return (
                  <ThreadRow
                    key={thread._id}
                    thread={thread}
                    now={now}
                    groupTitle={groupTitle}
                    groupColor={groupColor}
                    groups={props.groups}
                    selected={selected.has(thread._id)}
                    actions={props.actions}
                    onToggle={() => props.onToggleRow(thread._id)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <LibraryPagination
        page={page}
        total={props.total}
        size={search.size}
        onPageChange={props.onPageChange}
        onPageSizeChange={props.onPageSizeChange}
      />
    </div>
  );
}

type ThreadRowProps = {
  thread: LibraryThread;
  now: number;
  groupTitle: string | null;
  groupColor: GroupColor;
  groups: ReadonlyArray<LibraryGroup>;
  selected: boolean;
  actions: ThreadRowActions;
  onToggle: () => void;
};

function ThreadRow({ thread, now, groupTitle, groupColor, groups, selected, actions, onToggle }: ThreadRowProps) {
  const modelData = tryGetModelData(thread.latestModel);
  const modelName = modelData?.display.unique ?? modelData?.display.name ?? thread.latestModel;
  const messages = thread.messageCount === null ? "—" : format.number(thread.messageCount);

  return (
    <tr
      data-selected={selected}
      className="group/row border-b transition-colors last:border-b-0 hover:bg-muted/40 data-[selected=true]:bg-primary/6"
    >
      <td className="py-2 pl-3 align-middle">
        <Checkbox aria-label={`Select ${thread.title}`} checked={selected} onCheckedChange={onToggle} />
      </td>

      <td className="min-w-0 px-2 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {thread.branchedFrom && (
            <GitBranchIcon aria-label="Branched thread" className="size-3.5 shrink-0 rotate-180 text-muted-foreground" />
          )}
          <Link
            to="/threads/$threadId"
            params={{ threadId: toUUID(thread._id) }}
            preload={false}
            title={thread.title}
            className="min-w-0 truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {thread.title}
          </Link>
          {thread.pinned && <PinIcon aria-label="Pinned" className="size-3.5 shrink-0 text-amber-500" />}
          {thread.shared && <Share2Icon aria-label="Shared" className="size-3.5 shrink-0 text-violet-500" />}
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-x-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            {modelData ? (
              <Icons.provider provider={modelData.provider} aria-hidden="true" className="size-3 shrink-0" />
            ) : (
              <Icons.unknown aria-hidden="true" className="size-3 shrink-0" />
            )}
            <span className="truncate">{modelName}</span>
          </span>

          {/* What the hidden columns would have said, for narrow screens. */}
          <span className="flex shrink-0 items-center gap-2 @5xl:hidden">
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{messages} msgs</span>
            {thread.attachmentCount > 0 && (
              <span className="flex items-center gap-0.5 tabular-nums">
                <PaperclipIcon aria-hidden="true" className="size-3" />
                {thread.attachmentCount}
              </span>
            )}
            <span className="@3xl:hidden">
              <span aria-hidden="true">· </span>
              <RelativeTime time={thread.updatedAt} now={now} />
            </span>
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5 empty:hidden @xl:hidden">
          <StatusPill thread={thread} />
          {groupTitle !== null && <GroupChip title={groupTitle} color={groupColor} />}
        </div>
        {groupTitle !== null && (
          <div className="mt-1.5 hidden @xl:block @3xl:hidden">
            <GroupChip title={groupTitle} color={groupColor} />
          </div>
        )}
      </td>

      <td className="hidden px-2 py-2 @3xl:table-cell">
        {groupTitle === null ? (
          <span className="text-xs text-muted-foreground">Ungrouped</span>
        ) : (
          <GroupChip title={groupTitle} color={groupColor} />
        )}
      </td>

      <td className="hidden px-2 py-2 @xl:table-cell">
        <StatusPill thread={thread} />
      </td>

      <td
        className={cn(
          "hidden px-2 py-2 text-right tabular-nums @5xl:table-cell",
          thread.messageCount === null && "text-muted-foreground",
        )}
        title={thread.messageCount === null ? "Not counted yet" : undefined}
      >
        {messages}
      </td>

      <td
        className={cn(
          "hidden px-2 py-2 text-right tabular-nums @5xl:table-cell",
          thread.attachmentCount === 0 && "text-muted-foreground",
        )}
      >
        {format.number(thread.attachmentCount)}
      </td>

      <td className="hidden py-2 pr-2 pl-4 text-muted-foreground @3xl:table-cell">
        <RelativeTime time={thread.updatedAt} now={now} />
      </td>

      <td className="hidden px-2 py-2 text-muted-foreground @6xl:table-cell">
        <time dateTime={new Date(thread._creationTime).toISOString()} title={fullDate.format(thread._creationTime)}>
          {format.date(thread._creationTime)}
        </time>
      </td>

      <td className="py-2 pr-2 text-right">
        <RowMenu thread={thread} groups={groups} actions={actions} />
      </td>
    </tr>
  );
}

function RowMenu({
  thread,
  groups,
  actions,
}: {
  thread: LibraryThread;
  groups: ReadonlyArray<LibraryGroup>;
  actions: ThreadRowActions;
}) {
  const running = isRunning(thread);
  const destinations = groups.filter((group) => group._id !== thread.groupId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${thread.title}`}
            className="text-muted-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
          />
        }
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52 p-1">
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<Link to="/threads/$threadId" params={{ threadId: toUUID(thread._id) }} preload={false} />}
          >
            <ExternalLinkIcon />
            Open
          </DropdownMenuItem>
          {thread.branchedFrom && (
            <DropdownMenuItem
              render={
                <Link to="/threads/$threadId" params={{ threadId: toUUID(thread.branchedFrom) }} preload={false} />
              }
            >
              <GitBranchIcon className="rotate-180" />
              Go to parent thread
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => actions.rename(thread)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={running || thread.messageCount === 0}
            onClick={() => actions.regenerateTitle(thread)}
          >
            <RefreshCwIcon />
            Regenerate title
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={thread.settled && !thread.pinned}
            title={thread.settled && !thread.pinned ? "Unsettle the thread to pin it" : undefined}
            onClick={() => void actions.togglePin(thread)}
          >
            {thread.pinned ? <PinOffIcon /> : <PinIcon />}
            {thread.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!thread.settled && !isFinished(thread)}
            onClick={() => void actions.toggleSettled(thread)}
          >
            {thread.settled ? <Undo2Icon /> : <CircleCheckIcon />}
            {thread.settled ? "Unsettle" : "Settle"}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={destinations.length === 0 && thread.groupId === null}>
              <FolderInputIcon />
              Move to group
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48 p-1">
              {thread.groupId !== null && (
                <DropdownMenuItem onClick={() => void actions.move(thread, null)}>
                  <FolderIcon />
                  Ungrouped
                </DropdownMenuItem>
              )}
              {destinations.map((group) => (
                <DropdownMenuItem key={group._id} onClick={() => void actions.move(thread, group._id)}>
                  <FolderIcon />
                  <span className="truncate">{group.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => actions.share(thread)}>
            <Share2Icon />
            {thread.shared ? "Manage sharing" : "Share"}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={running}
          title={running ? "Wait for the response to finish" : undefined}
          onClick={() => actions.remove(thread)}
        >
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type LibraryPaginationProps = {
  page: LibraryPage;
  total: number;
  size: LibrarySearch["size"];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: LibrarySearch["size"]) => void;
};

function LibraryPagination({ page, total, size, onPageChange, onPageSizeChange }: LibraryPaginationProps) {
  return (
    <nav aria-label="Thread pages" className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {total === 0
            ? "No threads"
            : `${format.number(page.start)}–${format.number(page.end)} of ${format.number(total)}`}
        </span>
        <Select
          value={String(size)}
          onValueChange={(value) => {
            const next = toPageSize(value);
            if (next !== undefined) onPageSizeChange(next);
          }}
        >
          <SelectTrigger size="sm" aria-label="Threads per page" className="w-auto">
            <SelectValue>{(value: string) => `${value} per page`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {LIBRARY_PAGE_SIZES.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} per page
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {page.pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page.page <= 1}
            onClick={() => onPageChange(page.page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          {getPageItems(page.page, page.pageCount).map((item, index) =>
            item === null ? (
              // oxlint-disable-next-line react/no-array-index-key -- Gaps have no identity of their own.
              <span key={`gap-${index}`} aria-hidden="true" className="w-6 text-center text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page.page ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label={`Page ${item}`}
                aria-current={item === page.page ? "page" : undefined}
                className={cn("text-xs tabular-nums", item === page.page && "ring-1 ring-border")}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={page.page >= page.pageCount}
            onClick={() => onPageChange(page.page + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </nav>
  );
}
