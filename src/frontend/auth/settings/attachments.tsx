import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { FileTextIcon, TrashIcon } from "lucide-react";
import { useTransition } from "react";
import { NavLink } from "react-router";
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
import { Skeleton } from "@/components/ui/skeleton";

import { format, toUUID } from "@/lib/utils";

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

export function AttachmentsPage() {
  const { data, isPending } = useQuery(convexQuery(api.attachments.getAllAttachments, {}));
  if (isPending) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Attachments</h2>
        <p className="text-muted-foreground">View and manage your attachments.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {data?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-md border p-8 text-center">
            <p className="text-muted-foreground">No attachments found</p>
          </div>
        )}

        {data?.map((attachment) => (
          <div
            key={attachment._id}
            className="hover:bg-card/80 flex flex-col overflow-hidden rounded-md border transition-colors"
          >
            <div className="relative size-full">
              <a
                target="_blank"
                rel="noopener noreferrer"
                className="block size-full"
                href={`https://files.chat.asakuri.me/${attachment.userId}/${attachment.threadId}/${attachment._id}`}
              >
                {attachment.type === "image" ? (
                  <img
                    alt={attachment.name}
                    className="aspect-square size-full object-cover"
                    src={`https://files.chat.asakuri.me/${attachment.userId}/${attachment.threadId}/${attachment._id}`}
                  />
                ) : (
                  <div className="flex aspect-square size-full items-center justify-center p-2">
                    <FileTextIcon size={64} />
                  </div>
                )}
              </a>
              <div className="pointer-events-none absolute top-0 left-0 flex size-full items-start justify-between gap-2 p-2">
                <Badge>{format.size(attachment.size)}</Badge>
                <DeleteAttachmentDialog attachmentId={attachment._id} name={attachment.name}>
                  <Button
                    variant="secondary"
                    className="hover:bg-destructive pointer-events-auto size-7 transition-colors"
                  >
                    <TrashIcon />
                    <span className="sr-only">Delete {attachment.name}</span>
                  </Button>
                </DeleteAttachmentDialog>
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
              <NavLink
                to={`/chat/${toUUID(attachment.threadId)}`}
                className="line-clamp-1 w-fit text-sm underline-offset-4 hover:underline"
                title={attachment.thread?.title}
              >
                Thread: {attachment.thread?.title}
              </NavLink>
            </div>
          </div>
        ))}
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
  const deleteAttachment = useMutation(api.attachments.deleteAttachment);

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
