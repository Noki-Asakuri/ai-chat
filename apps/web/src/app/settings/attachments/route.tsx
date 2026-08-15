import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useMutation } from "convex/react";
import {
  ArrowDownAZIcon,
  ArrowDownNarrowWideIcon,
  ArrowUpAZIcon,
  ArrowUpNarrowWideIcon,
  ArchiveIcon,
  BotIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  FilesIcon,
  HardDriveIcon,
  ImageIcon,
  LayersIcon,
  PaperclipIcon,
  SearchIcon,
  TrashIcon,
  TriangleAlertIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useDeferredValue, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import { ImageLightboxProvider, ImageLightboxTrigger } from "@/components/image-lightbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { LoadingAttachmentsSkeleton } from "./-pending";

import { buildImageAssetUrl, buildImageThumbnailUrl, buildRawFileUrl } from "@/lib/assets/urls";
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
  "createdAt_desc" | "createdAt_asc" | "name_asc" | "name_desc" | "size_desc" | "size_asc";

const PAGE_SIZE = 20;

const GRID_IMAGE_TRANSFORM = "tr=w-448,h-448,c-at_max,f-auto,q-70";

function getAttachmentImageUrl(path: string): string {
  return buildImageAssetUrl(path);
}

function getAttachmentThumbnailUrl(path: string): string {
  return buildImageThumbnailUrl(buildImageAssetUrl(path), GRID_IMAGE_TRANSFORM);
}

function getAttachmentFileUrl(path: string): string {
  return buildRawFileUrl(path);
}

const SOURCE_FILTER_OPTIONS: Record<SourceFilter, { label: string; Icon: typeof ArrowDownAZIcon }> = {
  all: { label: "All sources", Icon: LayersIcon },
  user: { label: "User uploads", Icon: UserIcon },
  assistant: { label: "Assistant generated", Icon: BotIcon },
};

const SOURCE_FILTER_ORDER: Array<SourceFilter> = ["all", "user", "assistant"];

const TYPE_FILTER_OPTIONS: Record<AttachmentTypeFilter, { label: string; Icon: typeof ArrowDownAZIcon }> = {
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

function AttachmentsPage() {
  const deleteAttachments = useMutation(api.functions.attachments.deleteAttachments);

  const [searchText, setSearchText] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AttachmentTypeFilter>("all");
  const [sortField, setSortField] = useState<AttachmentSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<Id<"attachments">>>(() => new Set());
  const [deleteDialogState, setDeleteDialogState] = useState<{
    open: boolean;
    attachmentId: Id<"attachments"> | null;
    name: string;
  }>({
    open: false,
    attachmentId: null,
    name: "",
  });
  const [page, setPage] = useState<number>(1);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
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
  const attachments = data?.items ?? [];
  const totalItems = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const currentPage = data?.page ?? page;

  const imageItems = attachments.filter((attachment) => attachment.type === "image");

  const lightboxImages = imageItems.map((attachment) => ({
    src: getAttachmentImageUrl(attachment.path),
    thumbnailSrc: getAttachmentThumbnailUrl(attachment.path),
    alt: attachment.name,
    name: attachment.name,
    bytes: attachment.size,
  }));

  const imageIndexMap = (() => {
    const map = new Map<Id<"attachments">, number>();
    for (let index = 0; index < imageItems.length; index += 1) {
      const attachment = imageItems[index];
      if (!attachment) continue;
      map.set(attachment._id, index);
    }
    return map;
  })();

  const selectedBytes = (() => {
    if (selected.size === 0) return 0;
    let sum = 0;
    for (const attachment of attachments) {
      if (selected.has(attachment._id)) sum += attachment.size;
    }
    return sum;
  })();

  const currentPageBytes = (() => {
    let sum = 0;
    for (const attachment of attachments) {
      sum += attachment.size;
    }

    return sum;
  })();

  const selectedSourceOption = SOURCE_FILTER_OPTIONS[sourceFilter];
  const selectedTypeOption = TYPE_FILTER_OPTIONS[typeFilter];
  const selectedSortValue = getAttachmentSortValue(sortField, sortDirection);
  const selectedSortOption = ATTACHMENT_SORT_OPTIONS[selectedSortValue];
  const hasActiveFilters = searchText.trim().length > 0 || sourceFilter !== "all" || typeFilter !== "all";
  const allVisibleSelected =
    attachments.length > 0 && attachments.every((attachment) => selected.has(attachment._id));
  const firstVisibleItem = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastVisibleItem = Math.min(currentPage * PAGE_SIZE, totalItems);

  if (!data) return <LoadingAttachmentsSkeleton />;

  function onPageChange(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
    setSelected(new Set());
  }

  function openDeleteDialog(attachmentId: Id<"attachments">, name: string) {
    setDeleteDialogState({ open: true, attachmentId, name });
  }

  function closeDeleteDialog() {
    setDeleteDialogState({ open: false, attachmentId: null, name: "" });
  }

  function toggleSelectionMode() {
    if (selectionMode) setSelected(new Set());
    setSelectionMode(!selectionMode);
  }

  function toggleSelect(id: Id<"attachments">) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelected(new Set());
      return;
    }

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

  function resetFilters() {
    setSearchText("");
    setSourceFilter("all");
    setTypeFilter("all");
    setSortField("createdAt");
    setSortDirection("desc");
    resetPageAndSelection();
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
      setBulkDeleteDialogOpen(false);

      if (attachments.length === ids.length && page > 1) {
        setPage((previous) => Math.max(1, previous - 1));
      }

      toast.success("Selected files deleted");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Library</CardTitle>
            <CardAction>
              <ArchiveIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {format.number(data.overallCount)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Storage used</CardTitle>
            <CardAction>
              <HardDriveIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {format.size(data.overallBytes)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Current view</CardTitle>
            <CardAction>
              <FilesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{format.number(totalItems)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 border-y py-3">
        <div className="flex gap-2">
          <InputGroup className="h-9">
            <InputGroupInput
              aria-label="Search attachments"
              placeholder="Search by file name"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                resetPageAndSelection();
              }}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon />
            </InputGroupAddon>
            {searchText.length > 0 && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchText("");
                    resetPageAndSelection();
                  }}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          <Button
            variant={selectionMode ? "secondary" : "outline"}
            onClick={toggleSelectionMode}
            disabled={attachments.length === 0}
          >
            {selectionMode ? <XIcon data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
            {selectionMode ? "Done" : "Select"}
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_auto]">
          <Select
            value={sourceFilter}
            onValueChange={(value) => {
              if (!isSourceFilter(value)) return;
              setSourceFilter(value);
              resetPageAndSelection();
            }}
          >
            <SelectTrigger className="w-full">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <selectedSourceOption.Icon className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate" title={selectedSourceOption.label}>
                  {selectedSourceOption.label}
                </span>
              </div>
            </SelectTrigger>

            <SelectContent className="bg-card">
              <SelectGroup>
                {SOURCE_FILTER_ORDER.map((value) => {
                  const option = SOURCE_FILTER_OPTIONS[value];
                  const Icon = option.Icon;

                  return (
                    <SelectItem key={value} value={value}>
                      <Icon />
                      <span>{option.label}</span>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
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
            <SelectTrigger className="w-full">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <selectedTypeOption.Icon className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate" title={selectedTypeOption.label}>
                  {selectedTypeOption.label}
                </span>
              </div>
            </SelectTrigger>

            <SelectContent className="bg-card">
              <SelectGroup>
                {TYPE_FILTER_ORDER.map((value) => {
                  const option = TYPE_FILTER_OPTIONS[value];
                  const Icon = option.Icon;

                  return (
                    <SelectItem key={value} value={value}>
                      <Icon />
                      <span>{option.label}</span>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={selectedSortValue} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <selectedSortOption.Icon className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate" title={selectedSortOption.label}>
                  {selectedSortOption.label}
                </span>
              </div>
            </SelectTrigger>

            <SelectContent className="bg-card">
              <SelectGroup>
                {ATTACHMENT_SORT_ORDER.map((value) => {
                  const option = ATTACHMENT_SORT_OPTIONS[value];
                  const Icon = option.Icon;

                  return (
                    <SelectItem key={value} value={value}>
                      <Icon />
                      <span>{option.label}</span>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            onClick={resetFilters}
            disabled={!hasActiveFilters && selectedSortValue === "createdAt_desc"}
          >
            Reset
          </Button>
        </div>
      </div>

      {totalItems === 0 ? (
        <Empty className="rounded-md border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon className="size-4" />
            </EmptyMedia>
            <EmptyTitle>{hasActiveFilters ? "No matching attachments" : "No attachments yet"}</EmptyTitle>
            <EmptyDescription>
              {hasActiveFilters
                ? "Try another search or reset the filters."
                : "Files you share in conversations will appear here."}
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            {hasActiveFilters && <Button onClick={resetFilters}>Reset filters</Button>}
          </EmptyContent>
        </Empty>
      ) : (
        <ImageLightboxProvider images={lightboxImages}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
            {attachments.map((attachment) => {
              const isSelected = selected.has(attachment._id);
              const thumbnailUrl = getAttachmentThumbnailUrl(attachment.path);
              const fileUrl = getAttachmentFileUrl(attachment.path);
              const imageIndex = imageIndexMap.get(attachment._id) ?? -1;

              return (
                <Card
                  key={attachment._id}
                  className="group gap-0 py-0 [content-visibility:auto] data-[selected=true]:ring-2 data-[selected=true]:ring-ring"
                  data-selected={isSelected}
                >
                  <div className="relative overflow-hidden bg-muted/40">
                    {selectionMode ? (
                      <button
                        type="button"
                        className="block w-full cursor-pointer"
                        onClick={() => toggleSelect(attachment._id)}
                        aria-pressed={isSelected}
                        aria-label={`Select ${attachment.name}`}
                      >
                        {attachment.type === "image" ? (
                          <img
                            alt={attachment.name}
                            className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
                            src={thumbnailUrl}
                            loading="lazy"
                            decoding="async"
                            width={448}
                            height={448}
                          />
                        ) : (
                          <div className="flex aspect-[4/3] w-full items-center justify-center">
                            <FileTextIcon className="size-12 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                    ) : attachment.type === "image" && imageIndex >= 0 ? (
                      <ImageLightboxTrigger index={imageIndex} className="block w-full">
                        <img
                          src={thumbnailUrl}
                          alt={attachment.name}
                          className="aspect-[4/3] w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
                          loading="lazy"
                          decoding="async"
                          width={448}
                          height={448}
                        />
                      </ImageLightboxTrigger>
                    ) : (
                      <Link to={fileUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                        <div className="flex aspect-[4/3] w-full items-center justify-center">
                          <FileTextIcon className="size-12 text-muted-foreground" />
                        </div>
                      </Link>
                    )}

                    {selectionMode && (
                      <div className="absolute top-3 right-3 rounded-md bg-background/90 p-2 shadow-sm backdrop-blur-sm">
                        <Checkbox
                          aria-label={`Select ${attachment.name}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(attachment._id)}
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className={
                      attachment.source === "assistant"
                        ? "flex h-8 items-center gap-2 bg-destructive px-3 text-xs font-medium text-background"
                        : "flex h-8 items-center gap-2 bg-primary px-3 text-xs font-medium text-primary-foreground"
                    }
                  >
                    {attachment.source === "assistant" ? (
                      <BotIcon className="size-3.5" />
                    ) : (
                      <UserIcon className="size-3.5" />
                    )}
                    <span>{attachment.source === "assistant" ? "AI generated" : "User upload"}</span>
                  </div>

                  <CardHeader className="py-3">
                    <CardTitle className="truncate pr-2" title={attachment.name}>
                      {attachment.name}
                    </CardTitle>
                    <CardDescription>{format.date(attachment._creationTime)}</CardDescription>
                    {!selectionMode && (
                      <CardAction>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => openDeleteDialog(attachment._id, attachment.name)}
                          aria-label={`Delete ${attachment.name}`}
                        >
                          <TrashIcon />
                        </Button>
                      </CardAction>
                    )}
                  </CardHeader>

                  <CardContent className="min-w-0 pb-3">
                    {attachment.thread ? (
                      <Link
                        to="/threads/$threadId"
                        params={{ threadId: toUUID(attachment.threadId) }}
                        title={attachment.thread.title}
                        className="block truncate text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        From: {attachment.thread.title}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Conversation deleted</span>
                    )}
                  </CardContent>

                  <CardFooter className="mt-auto justify-between gap-2 py-2.5">
                    <span className="text-xs text-muted-foreground uppercase">{attachment.type}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {format.size(attachment.size)}
                    </span>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </ImageLightboxProvider>
      )}

      <DeleteAttachmentDialog
        open={deleteDialogState.open}
        onOpenChange={(open: boolean) => {
          if (!open) {
            closeDeleteDialog();
            return;
          }

          setDeleteDialogState((previous) => ({ ...previous, open }));
        }}
        attachmentId={deleteDialogState.attachmentId}
        name={deleteDialogState.name}
      />

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <TriangleAlertIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete {selected.size} selected files?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {format.size(selectedBytes)} from storage and unlinks the files from
              their conversations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onBulkDelete} disabled={bulkPending}>
              {bulkPending && <Spinner data-icon="inline-start" />}
              {bulkPending ? "Deleting" : "Delete files"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {totalItems > 0 && (
        <div className="flex w-full flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="tabular-nums">
            {firstVisibleItem}–{lastVisibleItem} of {format.number(totalItems)} ·{" "}
            {format.size(currentPageBytes)}
          </span>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="mr-1 tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!data.hasPrev}
              aria-label="Previous page"
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!data.hasNext}
              aria-label="Next page"
            >
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}

      {selectionMode && (
        <div className="fixed right-4 bottom-4 left-4 z-40 flex flex-wrap items-center gap-2 rounded-md bg-popover p-2 text-popover-foreground shadow-xl ring-1 ring-foreground/10 sm:left-auto">
          <div className="min-w-0 flex-1 px-1 sm:w-36 sm:flex-none">
            <p aria-live="polite" className="text-sm font-medium tabular-nums">
              {selected.size} selected
            </p>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {format.size(selectedBytes)}
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={toggleAllVisible}>
            {allVisibleSelected ? "Deselect page" : "Select page"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteDialogOpen(true)}
            disabled={selected.size === 0 || bulkPending}
          >
            <TrashIcon data-icon="inline-start" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

type DeleteAttachmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  attachmentId: Id<"attachments"> | null;
};

function DeleteAttachmentDialog({ open, onOpenChange, attachmentId, name }: DeleteAttachmentDialogProps) {
  const [pending, startTransition] = useTransition();
  const deleteAttachment = useMutation(api.functions.attachments.deleteAttachment);

  function onDelete() {
    if (!attachmentId) return;

    startTransition(async function () {
      const [, error] = await tryCatch(deleteAttachment({ attachmentId }));

      if (error) {
        toast.error("Failed to delete file", { description: error.message });
        return;
      }

      toast.success("File deleted");
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TriangleAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete file {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the file from storage and unlinks it from its conversation. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete} disabled={pending || !attachmentId}>
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? "Deleting" : "Delete file"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
