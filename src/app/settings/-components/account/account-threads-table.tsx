import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSessionMutation } from "convex-helpers/react/sessions";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import { EllipsisIcon, ExternalLinkIcon, PinIcon, PinOffIcon, TrashIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
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

import { convexSessionQuery } from "@/lib/convex/helpers";
import { cn, format, toUUID, tryCatch } from "@/lib/utils";

type AccountThread = {
  _id: Id<"threads">;
  _creationTime: number;

  title: string;
  updatedAt: number;
  pinned: boolean;
  status: "pending" | "streaming" | "complete" | "error";

  messageCount: number;
  attachmentCount: number;
};

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

export function AccountThreadsTable() {
  const [searchText, setSearchText] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [menuThreadId, setMenuThreadId] = useState<Id<"threads"> | null>(null);

  const [selected, setSelected] = useState<Set<Id<"threads">>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data } = useSuspenseQuery(
    convexSessionQuery(api.functions.threads.listAccountThreads, {
      query: searchText,
      limit: 10,
    }),
  );

  const pinThread = useSessionMutation(api.functions.threads.pinThread);

  const [, startTransition] = useTransition();

  const rows = data ?? [];
  const visibleIds = useMemo(() => rows.map((r) => r._id), [rows]);

  const selectedCount = selected.size;

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const someSelected = rows.some((r) => selected.has(r._id));

  function toggleRowSelection(id: Id<"threads">) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllVisibleSelection(nextChecked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);

      if (nextChecked) {
        for (const id of visibleIds) next.add(id);
      } else {
        for (const id of visibleIds) next.delete(id);
      }

      return next;
    });
  }

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
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(value) => setAllVisibleSelection(value === true)}
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
                className="min-w-0 truncate underline-offset-4 hover:underline"
              >
                {thread.title}
              </Link>
            </div>
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
    [allSelected, someSelected, menuThreadId, pinThread, selected, visibleIds],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
    if (!open) {
      setSelected(new Set());
    }
  }

  return (
    <div className="mt-4 flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search threads..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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
          <span className="font-medium">{rows.length}</span> shown •{" "}
          <span className={cn(selectedCount > 0 ? "text-foreground" : undefined)}>
            {selectedCount} selected
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-md border">
        <table className="w-full">
          <thead className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
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

          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center text-sm text-muted-foreground"
                >
                  No threads found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
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
        </table>
      </div>

      <div className="mt-auto border-t pt-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Danger zone</h3>
          <p className="text-sm text-muted-foreground">
            Permanently delete all of your data. This action cannot be undone.
          </p>

          <div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => toast.message("This feature is not available yet.")}
            >
              Request full data deletion
            </Button>
          </div>
        </div>
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
