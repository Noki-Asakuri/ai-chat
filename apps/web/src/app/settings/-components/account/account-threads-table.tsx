import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useSessionMutation } from "convex-helpers/react/sessions";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  PinIcon,
  PinOffIcon,
  Share2Icon,
  TrashIcon,
} from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactElement,
} from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Menu } from "@/components/ui/menu";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { cn, format, toUUID, tryCatch } from "@/lib/utils";

type AccountThread = {
  _id: Id<"threads">;
  _creationTime: number;

  title: string;
  updatedAt: number;
  pinned: boolean;
  shared: boolean;
  status: "pending" | "streaming" | "complete" | "error";

  messageCount: number;
  attachmentCount: number;
};

type AccountThreadSortField =
  | "title"
  | "pinned"
  | "shared"
  | "messageCount"
  | "attachmentCount"
  | "_creationTime"
  | "updatedAt"
  | "status";

type AccountThreadSortDirection = "asc" | "desc";

type AccountThreadSort = {
  sortField: AccountThreadSortField;
  sortDirection: AccountThreadSortDirection;
};

const THREADS_PAGE_SIZE = 15;
const PAGE_WINDOW_SIZE = 3;

function getVisiblePageNumbers(currentPage: number, maxPageNumber: number): Array<number> {
  const start = Math.max(1, currentPage - PAGE_WINDOW_SIZE);
  const end = Math.min(maxPageNumber, currentPage + PAGE_WINDOW_SIZE);

  const pageNumbers: Array<number> = [];
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pageNumbers.push(pageNumber);
  }

  return pageNumbers;
}

function getAccountThreadSort(sorting: SortingState): AccountThreadSort {
  const firstSort = sorting[0];
  if (!firstSort) {
    return { sortField: "updatedAt", sortDirection: "desc" };
  }

  const sortDirection: AccountThreadSortDirection = firstSort.desc ? "desc" : "asc";

  if (firstSort.id === "title") return { sortField: "title", sortDirection };
  if (firstSort.id === "pinned") return { sortField: "pinned", sortDirection };
  if (firstSort.id === "shared") return { sortField: "shared", sortDirection };
  if (firstSort.id === "messageCount") return { sortField: "messageCount", sortDirection };
  if (firstSort.id === "attachmentCount") return { sortField: "attachmentCount", sortDirection };
  if (firstSort.id === "_creationTime") return { sortField: "_creationTime", sortDirection };
  if (firstSort.id === "updatedAt") return { sortField: "updatedAt", sortDirection };
  if (firstSort.id === "status") return { sortField: "status", sortDirection };

  return { sortField: "updatedAt", sortDirection: "desc" };
}

function StatusBadge({ status }: { status: AccountThread["status"] }) {
  if (status === "complete") return <Badge variant="secondary">Complete</Badge>;
  if (status === "streaming") return <Badge>Streaming</Badge>;
  if (status === "pending") return <Badge>Pending</Badge>;
  return <Badge variant="destructive">Error</Badge>;
}

type BulkDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadIds: Array<Id<"threads">>;
  threadCount: number;
};

function BulkDeleteDialog({ open, onOpenChange, threadIds, threadCount }: BulkDeleteDialogProps) {
  const deleteThread = useSessionMutation(api.functions.threads.deleteThread);
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      for (const threadId of threadIds) {
        const [, error] = await tryCatch(deleteThread({ threadId, deleteAttachments: checked }));
        if (error) {
          toast.error("Failed to delete threads", { description: error.message });
          return;
        }
      }

      toast.success(`Deleted ${threadCount} thread(s)`);
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-3 p-4">
        <AlertDialogHeader className="gap-1">
          <AlertDialogTitle>Delete {threadCount} thread(s)?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the selected thread(s) and
            their messages.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2">
          <Checkbox
            id="bulk-delete-attachments"
            checked={checked}
            onCheckedChange={() => setChecked(!checked)}
            className="size-5"
          />

          <Label
            htmlFor="bulk-delete-attachments"
            className="text-sm leading-none"
            onClick={() => setChecked(!checked)}
          >
            Delete all attachments?
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AccountThreadsTableSkeleton() {
  const rows: Array<ReactElement> = [];
  for (let i = 0; i < 6; i += 1) {
    rows.push(
      <tr key={`row-${i}`} className="m-0 p-0">
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="size-5" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-[32ch] max-w-full" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-10" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-8" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-8" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-8" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-24" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-24" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-5 w-20" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <div className="flex justify-end">
            <Skeleton className="size-8 rounded-md" />
          </div>
        </td>
      </tr>,
    );
  }

  return (
    <div className="mt-4 flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-8 w-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-md border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr className="m-0 p-0">
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="size-5" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-14" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-10" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-12" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-10" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="px-3 py-1.5 text-left text-sm font-bold">
                <Skeleton className="h-4 w-16" />
              </th>
            </tr>
          </thead>

          <tbody>{rows}</tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>

      <div className="mt-auto border-t pt-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-[72ch] max-w-full" />
          <Skeleton className="h-9 w-56" />
        </div>
      </div>
    </div>
  );
}

type AccountThreadsTablePageInfo = {
  rowsCount: number;
  isDone: boolean;
  continueCursor: string | null;
  visibleIds: Array<Id<"threads">>;
};

type AccountThreadsTableBodyProps = {
  searchText: string;
  cursor: string | null;
  sorting: SortingState;
  columns: Array<ColumnDef<AccountThread>>;
  onResolved: (info: AccountThreadsTablePageInfo) => void;
};

function AccountThreadsTableBodySkeleton({ columnCount }: { columnCount: number }) {
  const rows: Array<ReactElement> = [];
  for (let i = 0; i < 10; i += 1) {
    rows.push(
      <tr key={`row-${i}`} className="m-0 p-0">
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="size-5" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-[60ch] max-w-full" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-10" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-8" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-8" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-8" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-24" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-4 w-24" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <Skeleton className="h-5 w-20" />
        </td>
        <td className="px-3 py-1.5 text-left text-sm">
          <div className="flex justify-end">
            <Skeleton className="size-8 rounded-md" />
          </div>
        </td>
      </tr>,
    );
  }

  return (
    <tbody>
      {rows}

      {columnCount <= 9 ? null : (
        <tr className="m-0 p-0">
          <td colSpan={columnCount} className="px-3 py-1.5 text-left text-sm">
            <Skeleton className="h-4 w-full" />
          </td>
        </tr>
      )}
    </tbody>
  );
}

function AccountThreadsTableBody({
  searchText,
  cursor,
  sorting,
  columns,
  onResolved,
}: AccountThreadsTableBodyProps) {
  const sort = getAccountThreadSort(sorting);

  const { data } = useSuspenseQuery(
    convexSessionQuery(api.functions.threads.listAccountThreads, {
      query: searchText,
      sortField: sort.sortField,
      sortDirection: sort.sortDirection,
      paginationOpts: {
        numItems: THREADS_PAGE_SIZE,
        cursor,
      },
    }),
  );

  const rows = data.page;
  const visibleIds = useMemo<Array<Id<"threads">>>(() => rows.map((r) => r._id), [rows]);

  useEffect(() => {
    onResolved({
      rowsCount: rows.length,
      isDone: data.isDone,
      continueCursor: data.continueCursor ?? null,
      visibleIds,
    });
  }, [data.continueCursor, data.isDone, onResolved, rows.length, visibleIds]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const rowModel = table.getRowModel();

  return (
    <tbody>
      {rowModel.rows.length === 0 ? (
        <tr>
          <td
            colSpan={columns.length}
            className="px-3 py-4 text-center text-sm text-muted-foreground"
          >
            No threads found
          </td>
        </tr>
      ) : (
        rowModel.rows.map((row) => (
          <tr key={row.id} className="m-0 p-0 transition-colors hover:bg-muted/40">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="px-3 py-1.5 text-left text-sm">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))
      )}
    </tbody>
  );
}

export function AccountThreadsTable() {
  const [searchText, setSearchText] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [menuThreadId, setMenuThreadId] = useState<Id<"threads"> | null>(null);
  const [pendingTargetPageIndex, setPendingTargetPageIndex] = useState<number | null>(null);
  const [knownLastPageNumber, setKnownLastPageNumber] = useState<number | null>(null);

  const [selected, setSelected] = useState<Set<Id<"threads">>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageCursors, setPageCursors] = useState<Array<string | null>>([null]);

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageInfo, setPageInfo] = useState<AccountThreadsTablePageInfo>(() => ({
    rowsCount: 0,
    isDone: false,
    continueCursor: null,
    visibleIds: [],
  }));

  const cursor = pageCursors[pageIndex] ?? null;

  const onResolved = useCallback(
    function (info: AccountThreadsTablePageInfo) {
      setPageInfo(info);
      setIsLoadingPage(false);

      if (info.isDone) {
        setKnownLastPageNumber(pageIndex + 1);
      }
    },
    [pageIndex],
  );

  const pinThread = useSessionMutation(api.functions.threads.pinThread);
  const [, startTransition] = useTransition();

  const selectedCount = selected.size;
  const currentPage = pageIndex + 1;
  const loadedPagesCount = pageCursors.length;
  const maxPageNumber = useMemo(
    function () {
      if (knownLastPageNumber) {
        return knownLastPageNumber;
      }

      if (loadedPagesCount <= 0) {
        return 1;
      }

      if (
        pageIndex === loadedPagesCount - 1 &&
        !isLoadingPage &&
        !pageInfo.isDone &&
        typeof pageInfo.continueCursor === "string"
      ) {
        return loadedPagesCount + 1;
      }

      return loadedPagesCount;
    },
    [
      isLoadingPage,
      knownLastPageNumber,
      loadedPagesCount,
      pageIndex,
      pageInfo.continueCursor,
      pageInfo.isDone,
    ],
  );

  const visiblePageNumbers = useMemo(
    () => getVisiblePageNumbers(currentPage, maxPageNumber),
    [currentPage, maxPageNumber],
  );
  const lastVisiblePageNumber = visiblePageNumbers[visiblePageNumbers.length - 1] ?? currentPage;

  const allSelected =
    pageInfo.visibleIds.length > 0 && pageInfo.visibleIds.every((id) => selected.has(id));
  const someSelected = pageInfo.visibleIds.some((id) => selected.has(id));

  function resetPaging() {
    setPageIndex(0);
    setPageCursors([null]);
    setPendingTargetPageIndex(null);
    setKnownLastPageNumber(null);
    setPageInfo({
      rowsCount: 0,
      isDone: false,
      continueCursor: null,
      visibleIds: [],
    });
    setIsLoadingPage(true);
  }

  function onSearchTextChange(next: string) {
    setSearchText(next);
    setSelected(new Set());
    resetPaging();
  }

  function goPreviousPage() {
    if (pageIndex === 0) return;
    if (isLoadingPage) return;

    setMenuThreadId(null);
    setPendingTargetPageIndex(null);
    setSelected(new Set());
    setIsLoadingPage(true);
    setPageIndex((prev) => prev - 1);
  }

  function goFirstPage() {
    if (pageIndex === 0) return;
    if (isLoadingPage) return;

    setMenuThreadId(null);
    setPendingTargetPageIndex(null);
    setSelected(new Set());
    setIsLoadingPage(true);
    setPageIndex(0);
  }

  function goLastLoadedPage() {
    const lastVisiblePageIndex = lastVisiblePageNumber - 1;
    if (lastVisiblePageIndex < 0) return;
    if (pageIndex === lastVisiblePageIndex) return;
    if (isLoadingPage) return;

    goToPage(lastVisiblePageNumber);
  }

  const goNextPage = useCallback(
    function (keepPending: boolean = false) {
      if (pageInfo.isDone) {
        if (keepPending) setPendingTargetPageIndex(null);
        return;
      }
      if (isLoadingPage) return;

      if (!keepPending) setPendingTargetPageIndex(null);

      const nextIndex = pageIndex + 1;
      const existing = pageCursors[nextIndex];
      if (typeof existing === "string") {
        setMenuThreadId(null);
        setSelected(new Set());
        setIsLoadingPage(true);
        setPageIndex(nextIndex);
        return;
      }

      const nextCursor = pageInfo.continueCursor;
      if (!nextCursor) {
        if (keepPending) setPendingTargetPageIndex(null);
        return;
      }

      setMenuThreadId(null);
      setSelected(new Set());
      setIsLoadingPage(true);
      setPageCursors((prev) => [...prev, nextCursor]);
      setPageIndex(nextIndex);
    },
    [isLoadingPage, pageCursors, pageIndex, pageInfo.continueCursor, pageInfo.isDone],
  );

  function goToPage(pageNumber: number) {
    if (pageNumber < 1) return;
    if (pageNumber > maxPageNumber) return;

    const nextPageIndex = pageNumber - 1;
    if (nextPageIndex === pageIndex) return;
    if (isLoadingPage) return;

    if (nextPageIndex < loadedPagesCount) {
      setMenuThreadId(null);
      setPendingTargetPageIndex(null);
      setSelected(new Set());
      setIsLoadingPage(true);
      setPageIndex(nextPageIndex);
      return;
    }

    if (pageInfo.isDone) return;

    setPendingTargetPageIndex(nextPageIndex);
    goNextPage(true);
  }

  useEffect(() => {
    if (pendingTargetPageIndex === null) return;

    if (pageIndex >= pendingTargetPageIndex) {
      setPendingTargetPageIndex(null);
      return;
    }

    if (isLoadingPage) return;

    if (pageInfo.isDone) {
      setPendingTargetPageIndex(null);
      return;
    }

    goNextPage(true);
  }, [goNextPage, isLoadingPage, pageIndex, pageInfo.isDone, pendingTargetPageIndex]);

  function toggleRowSelection(id: Id<"threads">) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const setAllVisibleSelection = useCallback(
    function (nextChecked: boolean) {
      setSelected((prev) => {
        const next = new Set(prev);

        if (nextChecked) {
          for (const id of pageInfo.visibleIds) next.add(id);
        } else {
          for (const id of pageInfo.visibleIds) next.delete(id);
        }

        return next;
      });
    },
    [pageInfo.visibleIds],
  );

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const columns = useMemo<Array<ColumnDef<AccountThread>>>(
    () => [
      {
        id: "select",
        enableSorting: false,
        header: () => (
          <div className="flex items-center">
            <Checkbox
              aria-label="Select all"
              checked={allSelected ? true : someSelected ? undefined : false}
              indeterminate={someSelected}
              onCheckedChange={(value) => setAllVisibleSelection(value === true)}
              disabled={isLoadingPage}
              className="size-5"
            />
          </div>
        ),
        cell: ({ row }) => {
          const thread = row.original;
          const checked = selected.has(thread._id);

          return (
            <Checkbox
              aria-label={`Select ${thread.title}`}
              checked={checked}
              onCheckedChange={() => toggleRowSelection(thread._id)}
              className="size-5"
            />
          );
        },
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          const thread = row.original;

          return (
            <div className="flex min-w-0 items-center gap-2">
              {thread.pinned && <PinIcon className="size-3 text-muted-foreground" />}
              <Link
                to="/threads/$threadId"
                params={{ threadId: toUUID(thread._id) }}
                title={thread.title}
                className="w-[60ch] min-w-0 truncate underline-offset-4 hover:underline"
              >
                {thread.title}
              </Link>
            </div>
          );
        },
      },
      {
        accessorKey: "pinned",
        header: "Pinned",
        cell: ({ row }) => (row.original.pinned ? "Yes" : "-"),
      },
      {
        accessorKey: "shared",
        header: "Shared",
        cell: ({ row }) => {
          const isShared = row.original.shared;
          if (!isShared) return "-";

          return (
            <span className="inline-flex items-center gap-1">
              <Share2Icon className="size-3 text-muted-foreground" />
              Yes
            </span>
          );
        },
      },
      {
        accessorKey: "messageCount",
        header: "Msgs",
        cell: ({ row }) => format.number(row.original.messageCount),
      },
      {
        accessorKey: "attachmentCount",
        header: "Atts",
        cell: ({ row }) => format.number(row.original.attachmentCount),
      },
      {
        accessorKey: "_creationTime",
        header: "Created",
        cell: ({ row }) => format.date(row.original._creationTime),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => format.date(row.original.updatedAt),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const thread = row.original;
          const open = menuThreadId === thread._id;

          return (
            <div className="flex justify-end">
              <Menu.Root
                open={open}
                onOpenChange={(nextOpen) => setMenuThreadId(nextOpen ? thread._id : null)}
              >
                <Menu.Trigger className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent">
                  <EllipsisIcon className="size-4" />
                  <span className="sr-only">Thread actions</span>
                </Menu.Trigger>

                <Menu.Portal>
                  <Menu.Positioner side="left" align="start" className="z-40 p-1" sideOffset={8}>
                    <Menu.Popup className="flex w-max origin-(--transform-origin) flex-col overflow-hidden rounded-md border bg-card shadow-lg">
                      <Menu.Item
                        render={
                          <Link
                            preload={false}
                            to="/threads/$threadId"
                            params={{ threadId: toUUID(thread._id) }}
                          />
                        }
                        className="inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      >
                        <ExternalLinkIcon className="size-4" />
                        Open
                      </Menu.Item>

                      <Menu.Item
                        onClick={() => {
                          startTransition(async function () {
                            await pinThread({ threadId: thread._id, pinned: !thread.pinned });
                          });
                        }}
                        className="inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      >
                        {thread.pinned ? (
                          <>
                            <PinOffIcon className="size-4" />
                            Unpin
                          </>
                        ) : (
                          <>
                            <PinIcon className="size-4" />
                            Pin
                          </>
                        )}
                      </Menu.Item>

                      <Menu.Item
                        onClick={() => {
                          setMenuThreadId(null);
                          setSelected((prev) => {
                            const next = new Set(prev);
                            next.add(thread._id);
                            return next;
                          });
                          setBulkDeleteOpen(true);
                        }}
                        className="inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <TrashIcon className="size-4" />
                        Delete
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </div>
          );
        },
      },
    ],
    [
      allSelected,
      isLoadingPage,
      menuThreadId,
      pinThread,
      selected,
      setAllVisibleSelection,
      someSelected,
      startTransition,
    ],
  );

  const headerTable = useReactTable({
    data: [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
  });

  async function bulkPin(nextPinned: boolean) {
    for (const threadId of selectedIds) {
      const [, error] = await tryCatch(pinThread({ threadId, pinned: nextPinned }));
      if (error) {
        toast.error("Failed to update threads", { description: error.message });
        return;
      }
    }
    toast.success(nextPinned ? "Pinned selected threads" : "Unpinned selected threads");
  }

  function openBulkDeleteDialog() {
    setMenuThreadId(null);
    setBulkDeleteOpen(true);
  }

  function onBulkDeleteDialogChange(open: boolean) {
    setBulkDeleteOpen(open);
    if (!open) setSelected(new Set());
  }

  return (
    <div className="mt-4 flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search threads..."
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            className="h-8 w-full"
          />

          <div className="flex items-center gap-2" hidden={selectedCount === 0}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCount === 0}
              onClick={() => startTransition(() => bulkPin(true))}
            >
              <PinIcon className="size-4" />
              Pin
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCount === 0}
              onClick={() => startTransition(() => bulkPin(false))}
            >
              <PinOffIcon className="size-4" />
              Unpin
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedCount === 0}
              onClick={openBulkDeleteDialog}
            >
              <TrashIcon className="size-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{pageInfo.rowsCount}</span> shown •{" "}
          <span className={cn(selectedCount > 0 ? "text-foreground" : undefined)}>
            {selectedCount} selected
          </span>
        </div>
      </div>

      <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border">
        <table className="w-full min-w-max">
          <thead className="bg-muted">
            {headerTable.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="m-0 p-0">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();

                  return (
                    <th key={header.id} className="px-3 py-1.5 text-left text-sm font-bold">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-2"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-xs text-muted-foreground">
                            {sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : ""}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <Suspense fallback={<AccountThreadsTableBodySkeleton columnCount={columns.length} />}>
            <AccountThreadsTableBody
              searchText={searchText}
              cursor={cursor}
              sorting={sorting}
              columns={columns}
              onResolved={onResolved}
            />
          </Suspense>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Page {currentPage}</div>

        <Pagination className="mx-0 ml-auto w-auto">
          <PaginationContent className="gap-2">
            <PaginationItem>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingPage || pageIndex === 0}
                onClick={goFirstPage}
                title="First Page"
                aria-label="First Page"
              >
                <ChevronsLeftIcon data-icon="inline-start" />
                First
              </Button>
            </PaginationItem>

            <PaginationItem>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingPage || pageIndex === 0}
                onClick={goPreviousPage}
                title="Previous Page"
                aria-label="Previous Page"
              >
                <ChevronLeftIcon data-icon="inline-start" />
                Prev
              </Button>
            </PaginationItem>

            {visiblePageNumbers.map((pageNumber) => (
              <PaginationItem key={`page-${pageNumber}`}>
                <Button
                  type="button"
                  variant={pageNumber === currentPage ? "secondary" : "outline"}
                  size="sm"
                  className="min-w-8 px-2 tabular-nums"
                  onClick={() => goToPage(pageNumber)}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                >
                  {pageNumber}
                </Button>
              </PaginationItem>
            ))}

            <PaginationItem>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingPage || pageInfo.isDone}
                onClick={() => goNextPage()}
                title="Next Page"
                aria-label="Next Page"
              >
                Next
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </PaginationItem>

            <PaginationItem>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingPage || currentPage === lastVisiblePageNumber}
                onClick={goLastLoadedPage}
                title="Last Page"
                aria-label="Last Page"
              >
                Last
                <ChevronsRightIcon data-icon="inline-end" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={onBulkDeleteDialogChange}
        threadIds={selectedIds}
        threadCount={selectedCount}
      />
    </div>
  );
}
