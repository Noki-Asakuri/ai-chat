import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSessionMutation } from "convex-helpers/react/sessions";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
  ArrowDownAZIcon,
  ArrowDownNarrowWideIcon,
  ArrowUpAZIcon,
  ArrowUpNarrowWideIcon,
  BotIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  ImageIcon,
  LayersIcon,
  PaperclipIcon,
  SearchIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { ImageLightboxProvider, ImageLightboxTrigger } from "@/components/image-lightbox";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

import { LoadingAttachmentsSkeleton } from "./-pending";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { format, toUUID, tryCatch } from "@/lib/utils";

export const Route = createFileRoute("/settings/attachments")({
  component: AttachmentsPage,
  pendingComponent: LoadingAttachmentsSkeleton,
  head: () => ({ meta: [{ title: "Attachments - AI Chat" }] }),
});

type SourceFilter = "all" | "user" | "assistant";
type AttachmentTypeFilter = "all" | "image" | "pdf";
type AttachmentSortField = "createdAt" | "name" | "size";
type SortDirection = "asc" | "desc";
type AttachmentSortValue =
  | "createdAt_desc"
  | "createdAt_asc"
  | "name_asc"
  | "name_desc"
  | "size_desc"
  | "size_asc";

const PAGE_SIZE = 20;
const PAGE_WINDOW = 1;

const SOURCE_FILTER_OPTIONS: Record<SourceFilter, { label: string; Icon: typeof ArrowDownAZIcon }> =
  {
    all: { label: "All sources", Icon: LayersIcon },
    user: { label: "User uploads", Icon: UserIcon },
    assistant: { label: "Assistant generated", Icon: BotIcon },
  };

const SOURCE_FILTER_ORDER: Array<SourceFilter> = ["all", "user", "assistant"];

const TYPE_FILTER_OPTIONS: Record<
  AttachmentTypeFilter,
  { label: string; Icon: typeof ArrowDownAZIcon }
> = {
  all: { label: "All types", Icon: PaperclipIcon },
  image: { label: "Images only", Icon: ImageIcon },
  pdf: { label: "PDFs only", Icon: FileTextIcon },
};

const TYPE_FILTER_ORDER: Array<AttachmentTypeFilter> = ["all", "image", "pdf"];

const ATTACHMENT_SORT_OPTIONS: Record<
  AttachmentSortValue,
  {
    label: string;
    sortField: AttachmentSortField;
    sortDirection: SortDirection;
    Icon: typeof ArrowDownAZIcon;
  }
> = {
  createdAt_desc: {
    label: "Date (newest first)",
    sortField: "createdAt",
    sortDirection: "desc",
    Icon: CalendarArrowDownIcon,
  },
  createdAt_asc: {
    label: "Date (oldest first)",
    sortField: "createdAt",
    sortDirection: "asc",
    Icon: CalendarArrowUpIcon,
  },
  name_asc: {
    label: "Name (A to Z)",
    sortField: "name",
    sortDirection: "asc",
    Icon: ArrowDownAZIcon,
  },
  name_desc: {
    label: "Name (Z to A)",
    sortField: "name",
    sortDirection: "desc",
    Icon: ArrowUpAZIcon,
  },
  size_desc: {
    label: "Size (largest first)",
    sortField: "size",
    sortDirection: "desc",
    Icon: ArrowUpNarrowWideIcon,
  },
  size_asc: {
    label: "Size (smallest first)",
    sortField: "size",
    sortDirection: "asc",
    Icon: ArrowDownNarrowWideIcon,
  },
};

const ATTACHMENT_SORT_ORDER: Array<AttachmentSortValue> = [
  "createdAt_desc",
  "createdAt_asc",
  "name_asc",
  "name_desc",
  "size_desc",
  "size_asc",
];

function isSourceFilter(value: string | null): value is SourceFilter {
  return value === "all" || value === "assistant" || value === "user";
}

function isAttachmentTypeFilter(value: string | null): value is AttachmentTypeFilter {
  return value === "all" || value === "image" || value === "pdf";
}

function isAttachmentSortValue(value: string | null): value is AttachmentSortValue {
  if (!value) return false;
  return value in ATTACHMENT_SORT_OPTIONS;
}

function getAttachmentSortValue(
  sortField: AttachmentSortField,
  sortDirection: SortDirection,
): AttachmentSortValue {
  if (sortField === "createdAt") {
    if (sortDirection === "desc") return "createdAt_desc";
    return "createdAt_asc";
  }

  if (sortField === "name") {
    if (sortDirection === "asc") return "name_asc";
    return "name_desc";
  }

  if (sortDirection === "desc") return "size_desc";
  return "size_asc";
}

function getPageItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    const direct: Array<number | "ellipsis"> = [];
    for (let page = 1; page <= totalPages; page += 1) direct.push(page);
    return direct;
  }

  const result: Array<number | "ellipsis"> = [1];

  const start = Math.max(2, currentPage - PAGE_WINDOW);
  const end = Math.min(totalPages - 1, currentPage + PAGE_WINDOW);

  if (start > 2) result.push("ellipsis");

  for (let page = start; page <= end; page += 1) {
    result.push(page);
  }

  if (end < totalPages - 1) result.push("ellipsis");

  result.push(totalPages);
  return result;
}

function AttachmentsPage() {
  const deleteAttachments = useSessionMutation(api.functions.attachments.deleteAttachments);

  const [searchText, setSearchText] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AttachmentTypeFilter>("all");
  const [sortField, setSortField] = useState<AttachmentSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<Id<"attachments">>>(() => new Set());
  const [page, setPage] = useState<number>(1);
  const [bulkPending, startBulkTransition] = useTransition();
  const deferredSearchText = useDeferredValue(searchText);

  const attachmentsQuery = useQuery({
    ...convexSessionQuery(api.functions.attachments.listAttachmentsPage, {
      page,
      pageSize: PAGE_SIZE,
      search: deferredSearchText.trim().length === 0 ? undefined : deferredSearchText,
      source: sourceFilter,
      type: typeFilter,
      sortField,
      sortDirection,
    }),
    placeholderData: keepPreviousData,
  });

  const data = attachmentsQuery.data;
  if (!data) return <LoadingAttachmentsSkeleton />;

  const attachments = data.items;
  const totalItems = data.totalCount;
  const totalPages = data.totalPages;
  const currentPage = data.page;

  const imageItems = useMemo(
    () => attachments.filter((attachment) => attachment.type === "image"),
    [attachments],
  );

  const lightboxImages = useMemo(
    () =>
      imageItems.map((attachment) => ({
        src: `https://ik.imagekit.io/gmethsnvl/ai-chat/${attachment.path}`,
        alt: attachment.name,
        name: attachment.name,
        bytes: attachment.size,
      })),
    [imageItems],
  );

  const imageIndexMap = useMemo(() => {
    const map = new Map<Id<"attachments">, number>();
    for (let index = 0; index < imageItems.length; index += 1) {
      const attachment = imageItems[index];
      if (!attachment) continue;
      map.set(attachment._id, index);
    }
    return map;
  }, [imageItems]);

  const selectedBytes = useMemo(() => {
    if (selected.size === 0) return 0;
    let sum = 0;
    for (const attachment of attachments) {
      if (selected.has(attachment._id)) sum += attachment.size;
    }
    return sum;
  }, [selected, attachments]);

  const pageItems = useMemo(() => getPageItems(currentPage, totalPages), [currentPage, totalPages]);
  const selectedSourceOption = SOURCE_FILTER_OPTIONS[sourceFilter];
  const selectedTypeOption = TYPE_FILTER_OPTIONS[typeFilter];
  const selectedSortValue = getAttachmentSortValue(sortField, sortDirection);
  const selectedSortOption = ATTACHMENT_SORT_OPTIONS[selectedSortValue];

  function onPageChange(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
    setSelected(new Set());
  }

  function toggleSelectionMode() {
    setSelectionMode((previous) => {
      if (previous) setSelected(new Set());
      return !previous;
    });
  }

  function toggleSelect(id: Id<"attachments">) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const next = new Set<Id<"attachments">>();
    for (const attachment of attachments) {
      next.add(attachment._id);
    }
    setSelected(next);
  }

  function resetPageAndSelection() {
    setPage(1);
    setSelected(new Set());
    setSelectionMode(false);
  }

  function handleSortChange(value: string | null) {
    if (!isAttachmentSortValue(value)) return;

    const option = ATTACHMENT_SORT_OPTIONS[value];
    setSortField(option.sortField);
    setSortDirection(option.sortDirection);
    resetPageAndSelection();
  }

  function onBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    startBulkTransition(async function () {
      const [, error] = await tryCatch(deleteAttachments({ attachmentIds: ids }));

      if (error) {
        toast.error("Failed to delete selected files", { description: error.message });
        return;
      }

      setSelected(new Set());
      setSelectionMode(false);

      if (attachments.length === ids.length && page > 1) {
        setPage((previous) => Math.max(1, previous - 1));
      }

      toast.success("Selected files deleted");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">{format.number(data.overallCount)}</span>{" "}
          attachments
        </div>

        <div className="flex items-center gap-2">
          <span>{format.size(data.overallBytes)} total</span>

          {(searchText.trim().length > 0 || sourceFilter !== "all" || typeFilter !== "all") && (
            <Badge variant="secondary">
              Filtered: {format.number(totalItems)} ({format.size(data.filteredBytes)})
            </Badge>
          )}
        </div>
      </div>

      <div className="sticky top-24 z-10 rounded-md border bg-background p-3">
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <SearchIcon
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />

            <Input
              placeholder="Search attachment names..."
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                resetPageAndSelection();
              }}
              className="h-9 w-full pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                if (!isSourceFilter(value)) return;
                setSourceFilter(value);
                resetPageAndSelection();
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <selectedSourceOption.Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="shrink-0 text-muted-foreground">Source</span>
                  <span className="min-w-0 truncate" title={selectedSourceOption.label}>
                    {selectedSourceOption.label}
                  </span>
                </div>
              </SelectTrigger>

              <SelectContent className="bg-card">
                {SOURCE_FILTER_ORDER.map((value) => {
                  const option = SOURCE_FILTER_OPTIONS[value];
                  const Icon = option.Icon;

                  return (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(value) => {
                if (!isAttachmentTypeFilter(value)) return;
                setTypeFilter(value);
                resetPageAndSelection();
              }}
            >
              <SelectTrigger className="w-full sm:w-[170px]">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <selectedTypeOption.Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="shrink-0 text-muted-foreground">Type</span>
                  <span className="min-w-0 truncate" title={selectedTypeOption.label}>
                    {selectedTypeOption.label}
                  </span>
                </div>
              </SelectTrigger>

              <SelectContent className="bg-card">
                {TYPE_FILTER_ORDER.map((value) => {
                  const option = TYPE_FILTER_OPTIONS[value];
                  const Icon = option.Icon;

                  return (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={selectedSortValue} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <selectedSortOption.Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="shrink-0 text-muted-foreground">Sort</span>
                  <span className="min-w-0 truncate" title={selectedSortOption.label}>
                    {selectedSortOption.label}
                  </span>
                </div>
              </SelectTrigger>

              <SelectContent className="bg-card">
                {ATTACHMENT_SORT_ORDER.map((value) => {
                  const option = ATTACHMENT_SORT_OPTIONS[value];
                  const Icon = option.Icon;

                  return (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
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
                  onClick={selectAllVisible}
                  disabled={attachments.length === 0}
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

      {totalItems === 0 ? (
        <Empty className="rounded-md border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon className="size-4" />
            </EmptyMedia>
            <EmptyTitle>No attachments found</EmptyTitle>
            <EmptyDescription>Try adjusting your search, source, or type filters.</EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <Button
              variant="secondary"
              onClick={() => {
                setSearchText("");
                setSourceFilter("all");
                setTypeFilter("all");
                setSortField("createdAt");
                setSortDirection("desc");
                resetPageAndSelection();
              }}
            >
              Reset filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ImageLightboxProvider images={lightboxImages}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {attachments.map((attachment) => {
              const isSelected = selected.has(attachment._id);
              const imageUrl = `https://ik.imagekit.io/gmethsnvl/ai-chat/${attachment.path}`;
              const fileUrl = `https://files.chat.asakuri.me/${attachment.path}`;
              const imageIndex = imageIndexMap.get(attachment._id) ?? -1;

              return (
                <div
                  key={attachment._id}
                  className="group flex flex-col overflow-hidden rounded-md border bg-card"
                  data-selected={isSelected}
                >
                  <div className="relative">
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
                            decoding="async"
                          />
                        ) : (
                          <div className="flex aspect-square size-full items-center justify-center p-2">
                            <FileTextIcon size={64} />
                          </div>
                        )}
                      </button>
                    ) : attachment.type === "image" && imageIndex >= 0 ? (
                      <ImageLightboxTrigger index={imageIndex} className="block size-full">
                        <img
                          src={imageUrl}
                          alt={attachment.name}
                          className="aspect-square size-full object-cover object-center"
                          loading="lazy"
                          decoding="async"
                        />
                      </ImageLightboxTrigger>
                    ) : (
                      <Link
                        to={fileUrl}
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
                        <DeleteAttachmentDialog
                          attachmentId={attachment._id}
                          name={attachment.name}
                        >
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
                      <Badge
                        variant={attachment.source === "assistant" ? "destructive" : "secondary"}
                      >
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

                    {attachment.thread ? (
                      <Link
                        to="/threads/$threadId"
                        params={{ threadId: toUUID(attachment.threadId) }}
                        title={attachment.thread.title}
                        className="line-clamp-1 w-fit text-sm underline-offset-4 hover:underline"
                      >
                        Thread: {attachment.thread.title}
                      </Link>
                    ) : (
                      <span className="w-full text-sm select-none">Thread: [Deleted]</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ImageLightboxProvider>
      )}

      {totalItems > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{format.number(totalItems)} attachments</span>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <Pagination>
            <PaginationContent className="gap-2">
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={!data.hasPrev}
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                  Prev
                </Button>
              </PaginationItem>

              {pageItems.map((entry, index) => {
                if (entry === "ellipsis") {
                  return (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                return (
                  <PaginationItem key={`page-${entry}`}>
                    <PaginationLink
                      href="#"
                      isActive={entry === currentPage}
                      onClick={(event) => {
                        event.preventDefault();
                        onPageChange(entry);
                      }}
                      size="icon"
                    >
                      {entry}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={!data.hasNext}
                >
                  Next
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

type DeleteAttachmentDialogProps = {
  name: string;
  children: React.ReactElement;
  attachmentId: Id<"attachments">;
};

function DeleteAttachmentDialog({ attachmentId, name, children }: DeleteAttachmentDialogProps) {
  const [pending, startTransition] = useTransition();
  const deleteAttachment = useSessionMutation(api.functions.attachments.deleteAttachment);

  function onDelete() {
    startTransition(async function () {
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
      <AlertDialogTrigger render={children} />
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
