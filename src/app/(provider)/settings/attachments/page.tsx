"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { FileTextIcon, SearchIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { format, toUUID, tryCatch } from "@/lib/utils";

type SourceFilter = "all" | "user" | "assistant";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Attachments</h2>
        <p className="text-muted-foreground">View and manage your attachments.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
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

  // Selection mode and state
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<Id<"attachments">>>(() => new Set());
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

  const filteredData = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const list = (data ?? []).filter((attachment) => {
      // Search by name or thread title
      const name = attachment.name.toLowerCase();
      const threadTitle = (attachment.thread?.title ?? "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || threadTitle.includes(q);

      // Filter by source if requested; treat missing as "user" for backwards compatibility
      const src = attachment.source ?? "user";
      const matchesSource = sourceFilter === "all" || src === sourceFilter;

      return matchesSearch && matchesSource;
    });

    return list;
  }, [data, searchText, sourceFilter]);

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
      <div>
        <h2 className="text-2xl font-bold">Attachments</h2>
        <p className="text-muted-foreground">View and manage your attachments.</p>
      </div>

      <div className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 py-2 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md sm:max-w-[unset]">
            <SearchIcon
              size={16}
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />

            <Input
              placeholder="Search attachments..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-9 w-full pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
              <SelectTrigger>
                <SelectValue aria-label="Filter by source" placeholder="Source: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Source: All</SelectItem>
                <SelectItem value="user">Source: User uploads</SelectItem>
                <SelectItem value="assistant">Source: Assistant generated</SelectItem>
              </SelectContent>
            </Select>

            {!selectionMode && (
              <Button variant="outline" onClick={toggleSelectionMode}>
                Select
              </Button>
            )}

            {selectionMode && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-max text-sm">
                  {selected.size} selected
                </span>

                <Button
                  variant="secondary"
                  onClick={() => selectAllVisible(filteredData)}
                  disabled={filteredData.length === 0}
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filteredData.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-md border p-8 text-center">
            <p className="text-muted-foreground">No attachments found</p>
          </div>
        )}

        {filteredData.map((attachment) => {
          const isSelected = selected.has(attachment._id);
          const imageUrl = `https://files.chat.asakuri.me/${attachment.userId}/${attachment.threadId}/${attachment._id}`;

          return (
            <div
              key={attachment._id}
              className="hover:bg-card/80 group flex flex-col overflow-hidden rounded-md border transition-colors"
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
                      />
                    ) : (
                      <div className="flex aspect-square size-full items-center justify-center p-2">
                        <FileTextIcon size={64} />
                      </div>
                    )}
                  </button>
                ) : (
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block size-full"
                    href={imageUrl}
                  >
                    {attachment.type === "image" ? (
                      <img
                        alt={attachment.name}
                        className="aspect-square size-full object-cover"
                        src={imageUrl}
                      />
                    ) : (
                      <div className="flex aspect-square size-full items-center justify-center p-2">
                        <FileTextIcon size={64} />
                      </div>
                    )}
                  </a>
                )}

                <div className="pointer-events-none absolute top-0 left-0 flex size-full items-start justify-between gap-2 p-2">
                  <div className="flex items-center gap-2">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${attachment.name}`}
                        className="bg-background pointer-events-auto size-5 cursor-pointer rounded border"
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
                        className="hover:bg-destructive pointer-events-auto size-7 transition-colors"
                      >
                        <TrashIcon />
                        <span className="sr-only">Delete {attachment.name}</span>
                      </Button>
                    </DeleteAttachmentDialog>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 border-t p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate" title={attachment.name}>
                    {attachment.name}
                  </p>
                  <span className="text-muted-foreground shrink-0 text-sm">
                    {format.date(attachment._creationTime)}
                  </span>
                </div>
                <Link
                  href={`/threads/${toUUID(attachment.threadId)}`}
                  className="line-clamp-1 w-fit text-sm underline-offset-4 hover:underline"
                  title={attachment.thread?.title}
                >
                  Thread: {attachment.thread?.title}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type DeleteAttachmentDialogProps = {
  attachmentId: Id<"attachments">;
  name: string;
  children?: React.ReactNode;
};

function DeleteAttachmentDialog({ attachmentId, name, children }: DeleteAttachmentDialogProps) {
  const [pending, startTransition] = useTransition();
  const deleteAttachment = useMutation(api.functions.attachments.deleteAttachment);

  function onDelete() {
    startTransition(() => {
      toast.promise(deleteAttachment({ attachmentId }), {
        loading: "Deleting file...",
        success: "File deleted",
        error: "Failed to delete file",
      });
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
