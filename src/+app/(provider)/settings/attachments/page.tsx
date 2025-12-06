"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import {
  ArrowDownAZIcon,
  ArrowDownNarrowWideIcon,
  ArrowUpAZIcon,
  ArrowUpNarrowWideIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  FileTextIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { format, toUUID, tryCatch } from "@/lib/utils";

type SourceFilter = "all" | "user" | "assistant";
type AttachmentTypeFilter = "all" | "image" | "pdf";
type AttachmentSortField = "createdAt" | "name" | "size";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 20;

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Attachments</h2>
        <p className="text-muted-foreground">View and manage your attachments.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex w-full flex-col rounded-md border">
            <Skeleton className="relative aspect-square size-full rounded-none" />

            <div className="flex flex-col gap-1 border-t p-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>

              <Skeleton className="h-5 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AttachmentsPage() {
  const { data, isPending } = useQuery(
    convexQuery(api.functions.attachments.getAllAttachments, {}),
  );

  const [searchText, setSearchText] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AttachmentTypeFilter>("all");
  const [sortField, setSortField] = useState<AttachmentSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<Id<"attachments">>>(() => new Set());
  const [page, setPage] = useState<number>(1);
  const [bulkPending, startBulkTransition] = useTransition();
  const deleteAttachments = useMutation(api.functions.attachments.deleteAttachments);

  function toggleSelectionMode() {
    setSelectionMode((s) => {
      if (s) setSelected(new Set());
      return !s;
    });
  }

  function toggleSelect(id: Id<"attachments">) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible(current: Array<{ _id: Id<"attachments"> }>) {
    const all = new Set<Id<"attachments">>();
    for (const a of current) all.add(a._id);
    setSelected(all);
  }

  function handleSortChange(value: string) {
    const [field, direction] = value.split("_");

    if (
      (field === "createdAt" || field === "name" || field === "size") &&
      (direction === "asc" || direction === "desc")
    ) {
      setSortField(field);
      setSortDirection(direction);
      setPage(1);
    }
  }

  const filteredData = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const list = (data ?? []).filter((attachment) => {
      const name = attachment.name.toLowerCase();
      const threadTitle = (attachment.thread?.title ?? "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || threadTitle.includes(q);

      const src = attachment.source ?? "user";
      const matchesSource = sourceFilter === "all" || src === sourceFilter;

      const matchesType = typeFilter === "all" || attachment.type === typeFilter;

      return matchesSearch && matchesSource && matchesType;
    });

    return list;
  }, [data, searchText, sourceFilter, typeFilter]);

  const sortedData = useMemo(() => {
    const list = [...filteredData];

    list.sort((a, b) => {
      if (sortField === "createdAt") {
        if (a._creationTime < b._creationTime) return -1;
        if (a._creationTime > b._creationTime) return 1;
        return 0;
      }

      if (sortField === "name") {
        const left = a.name.toLowerCase();
        const right = b.name.toLowerCase();

        if (left < right) return -1;
        if (left > right) return 1;
        return 0;
      }

      if (a.size < b.size) return -1;
      if (a.size > b.size) return 1;
      return 0;
    });

    if (sortDirection === "desc") {
      list.reverse();
    }

    return list;
  }, [filteredData, sortField, sortDirection]);

  const totalItems = sortedData.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / PAGE_SIZE);
  const currentPage = page > totalPages ? totalPages : page;

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    return sortedData.slice(start, end);
  }, [sortedData, currentPage]);

  const imageAttachments = useMemo(
    () => sortedData.filter((a) => a.type === "image"),
    [sortedData],
  );

  const galleryImages = useMemo(
    () =>
      imageAttachments.map((a) => ({
        src: `https://ik.imagekit.io/gmethsnvl/ai-chat/${a.path}`,
        alt: a.name,
        name: a.name,
        size: a.size,
      })),
    [imageAttachments],
  );

  const imageIndexById = useMemo(() => {
    const m = new Map<Id<"attachments">, number>();
    imageAttachments.forEach((a, i) => m.set(a._id, i));
    return m;
  }, [imageAttachments]);

  const totals = useMemo(() => {
    const list = data ?? [];
    const count = list.length;
    const bytes = list.reduce((sum, a) => sum + a.size, 0);
    return { count, bytes };
  }, [data]);

  const selectedBytes = useMemo(() => {
    if (selected.size === 0) return 0;
    const ids = new Set(selected);
    const list = data ?? [];
    let sum = 0;
    for (const a of list) {
      if (ids.has(a._id)) sum += a.size;
    }
    return sum;
  }, [selected, data]);

  function onBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const [, error] = await tryCatch(deleteAttachments({ attachmentIds: ids }));

      if (error) {
        toast.error("Failed to delete selected files", { description: error.message });
        return;
      }

      setSelected(new Set());
      setSelectionMode(false);
      toast.success("Selected files deleted");
    });
  }

  if (isPending) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Attachments</h2>
          <p className="text-muted-foreground">View and manage your attachments.</p>
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{totals.count}</span> attachments •{" "}
          <span className="font-medium">{format.size(totals.bytes)} total</span>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-background/80 py-2 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <SearchIcon
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />

            <Input
              placeholder="Search attachments..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={sourceFilter}
              onValueChange={(v) => {
                setSourceFilter(v as SourceFilter);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue aria-label="Filter by source" placeholder="Source: All" />
              </SelectTrigger>

              <SelectContent className="bg-card">
                <SelectItem value="all">Source: All</SelectItem>
                <SelectItem value="user">Source: User uploads</SelectItem>
                <SelectItem value="assistant">Source: Assistant generated</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as AttachmentTypeFilter);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue aria-label="Filter by type" placeholder="Type: All" />
              </SelectTrigger>

              <SelectContent className="bg-card">
                <SelectItem value="all">Type: All</SelectItem>
                <SelectItem value="image">Type: Images</SelectItem>
                <SelectItem value="pdf">Type: PDFs</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortField}_${sortDirection}`} onValueChange={handleSortChange}>
              <SelectTrigger>
                <SelectValue aria-label="Sort attachments" placeholder="Sort" />
              </SelectTrigger>

              <SelectContent className="bg-card">
                <SelectItem value="createdAt_desc">
                  <div className="flex items-center gap-2">
                    <CalendarArrowDownIcon className="size-4" />
                    <span>Date created newest first</span>
                  </div>
                </SelectItem>
                <SelectItem value="createdAt_asc">
                  <div className="flex items-center gap-2">
                    <CalendarArrowUpIcon className="size-4" />
                    <span>Date created oldest first</span>
                  </div>
                </SelectItem>
                <SelectItem value="name_asc">
                  <div className="flex items-center gap-2">
                    <ArrowDownAZIcon className="size-4" />
                    <span>Name A to Z</span>
                  </div>
                </SelectItem>
                <SelectItem value="name_desc">
                  <div className="flex items-center gap-2">
                    <ArrowUpAZIcon className="size-4" />
                    <span>Name Z to A</span>
                  </div>
                </SelectItem>
                <SelectItem value="size_desc">
                  <div className="flex items-center gap-2">
                    <ArrowUpNarrowWideIcon className="size-4" />
                    <span>Size largest first</span>
                  </div>
                </SelectItem>
                <SelectItem value="size_asc">
                  <div className="flex items-center gap-2">
                    <ArrowDownNarrowWideIcon className="size-4" />
                    <span>Size smallest first</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {!selectionMode && (
              <Button variant="outline" className="ml-auto" onClick={toggleSelectionMode}>
                Select
              </Button>
            )}

            {selectionMode && (
              <div className="ml-auto flex items-center gap-2">
                <div className="flex w-max flex-col leading-tight">
                  <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                  <span className="text-center text-xs text-muted-foreground">
                    {format.size(selectedBytes)} total
                  </span>
                </div>

                <Button
                  variant="secondary"
                  onClick={() => selectAllVisible(paginatedData)}
                  disabled={paginatedData.length === 0}
                >
                  Select all
                </Button>

                <Button
                  variant="destructive"
                  onClick={onBulkDelete}
                  disabled={selected.size === 0 || bulkPending}
                >
                  {bulkPending ? "Deleting..." : "Delete selected"}
                </Button>

                <Button variant="outline" onClick={toggleSelectionMode}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {totalItems === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-md border p-8 text-center">
            <p className="text-muted-foreground">No attachments found</p>
          </div>
        )}

        {paginatedData.map((attachment) => {
          const isSelected = selected.has(attachment._id);
          const imageUrl = `https://ik.imagekit.io/gmethsnvl/ai-chat/${attachment.path}`;
          const fileUrl = `https://files.chat.asakuri.me/${attachment.path}`;

          return (
            <div
              key={attachment._id}
              className="group /80 flex flex-col overflow-hidden rounded-md border transition-colors"
              data-selected={isSelected}
            >
              <div className="relative size-full">
                {selectionMode ? (
                  <button
                    type="button"
                    className="block size-full cursor-pointer"
                    onClick={() => toggleSelect(attachment._id)}
                    aria-pressed={isSelected}
                    aria-label={`Select ${attachment.name}`}
                  >
                    {attachment.type === "image" ? (
                      <img
                        alt={attachment.name}
                        className="aspect-square size-full object-cover"
                        src={imageUrl}
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-square size-full items-center justify-center p-2">
                        <FileTextIcon size={64} />
                      </div>
                    )}
                  </button>
                ) : attachment.type === "image" ? (
                  <ImagePreviewDialog
                    className="block size-full"
                    image={{
                      src: imageUrl,
                      alt: attachment.name,
                      name: attachment.name,
                      size: attachment.size,
                    }}
                    images={galleryImages}
                    initialIndex={imageIndexById.get(attachment._id) ?? 0}
                  >
                    <img
                      alt={attachment.name}
                      className="aspect-square size-full object-cover"
                      src={imageUrl}
                      loading="lazy"
                    />
                  </ImagePreviewDialog>
                ) : (
                  <Link
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block size-full"
                  >
                    <div className="flex aspect-square size-full items-center justify-center p-2">
                      <FileTextIcon size={64} />
                    </div>
                  </Link>
                )}

                <div className="pointer-events-none absolute top-0 left-0 flex size-full items-start justify-between gap-2 p-2">
                  <div className="flex items-center gap-2">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${attachment.name}`}
                        className="pointer-events-auto size-5 cursor-pointer rounded border bg-background"
                        checked={isSelected}
                        onChange={() => toggleSelect(attachment._id)}
                      />
                    )}

                    <Badge>{format.size(attachment.size)}</Badge>
                  </div>

                  {!selectionMode && (
                    <DeleteAttachmentDialog attachmentId={attachment._id} name={attachment.name}>
                      <Button
                        variant="secondary"
                        className="pointer-events-auto size-7 transition-colors hover:bg-destructive"
                      >
                        <TrashIcon />
                        <span className="sr-only">Delete {attachment.name}</span>
                      </Button>
                    </DeleteAttachmentDialog>
                  )}
                </div>

                <div className="pointer-events-none absolute top-0 left-0 flex size-full items-end justify-between gap-2 p-2">
                  <Badge variant={attachment.source === "assistant" ? "destructive" : "secondary"}>
                    {attachment.source === "assistant" ? "AI" : "User"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col gap-1 border-t p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate" title={attachment.name}>
                    {attachment.name}
                  </p>

                  <span className="shrink-0 text-sm text-muted-foreground">
                    {format.date(attachment._creationTime)}
                  </span>
                </div>

                {attachment.thread && (
                  <Link
                    prefetch={false}
                    title={attachment.thread.title}
                    href={`/threads/${toUUID(attachment.threadId)}`}
                    className="line-clamp-1 w-fit text-sm underline-offset-4 hover:underline"
                  >
                    Thread: {attachment.thread.title}
                  </Link>
                )}

                {!attachment.thread && (
                  <span className="w-full text-sm select-none">Thread: [Deleted]</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalItems > 0 && (
        <div className="flex items-center justify-between gap-2 pt-2 text-sm text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages} • {totalItems} attachments
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => (prev >= totalPages ? totalPages : prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type DeleteAttachmentDialogProps = {
  name: string;
  children?: React.ReactNode;
  attachmentId: Id<"attachments">;
};

function DeleteAttachmentDialog({ attachmentId, name, children }: DeleteAttachmentDialogProps) {
  const [pending, startTransition] = useTransition();
  const deleteAttachment = useMutation(api.functions.attachments.deleteAttachment);

  function onDelete() {
    startTransition(async () => {
      const [, error] = await tryCatch(deleteAttachment({ attachmentId }));

      if (error) {
        toast.error("Failed to delete file", { description: error.message });
        return;
      }

      toast.success("File deleted");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete file {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this file and remove it from
            our servers and your chats!
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} disabled={pending}>
            {pending ? "Deleting..." : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
