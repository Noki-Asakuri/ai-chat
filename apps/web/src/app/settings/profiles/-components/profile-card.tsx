import { api } from "@ai-chat/backend/convex/_generated/api";

import { useMutation } from "convex/react";
import { FolderIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ProfileAvatar } from "@/components/profiles/profile-avatar";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";

import type { LibraryProfile, ProfileDefaultPlace } from "@/lib/profiles/profile-library";
import { format } from "@/lib/utils";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatUpdated(timestamp: number): string {
  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeTime.format(days, "day");
  return format.date(timestamp);
}

export function ProfileCard({
  profile,
  defaultPlaces,
  onEdit,
}: {
  profile: LibraryProfile;
  /** The groups whose new chats start with this profile. */
  defaultPlaces: ProfileDefaultPlace[];
  onEdit: (profile: LibraryProfile) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteProfile = useMutation(api.functions.profiles.deleteProfile);

  async function handleDelete() {
    try {
      await deleteProfile({ profileId: profile._id });
      toast.success(`Deleted “${profile.name}”`);
    } catch (error) {
      toast.error("Couldn't delete the profile", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <li className="group/card relative flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/15 hover:bg-muted/20 has-[[data-slot=card-open]:focus-visible]:ring-3 has-[[data-slot=card-open]:focus-visible]:ring-ring/50">
      <div className="flex items-start gap-3">
        <ProfileAvatar
          name={profile.name}
          imageKey={profile.imageKey}
          className="size-11"
          fallbackClassName="text-sm"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
          <h3 className="truncate text-sm font-semibold">
            {/* The whole card opens the editor; the menu button sits above this overlay. */}
            <button
              type="button"
              data-slot="card-open"
              onClick={() => onEdit(profile)}
              className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-lg"
            >
              {profile.name}
            </button>
          </h3>

          {defaultPlaces.length > 0 ? (
            <ul aria-label="Default for new chats in" className="flex flex-wrap gap-1">
              {defaultPlaces.map((place) => (
                <li
                  key={place.id}
                  className="inline-flex max-w-40 items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  <FolderIcon aria-hidden="true" className="size-3 shrink-0" />
                  <span className="truncate">{place.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Not a group default</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative z-10 -mt-1 -mr-1 text-muted-foreground"
                aria-label={`Actions for ${profile.name}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(profile)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="line-clamp-3 min-h-[3lh] text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
        {profile.systemPrompt}
      </p>

      <p className="mt-auto flex items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
        {/* Relative to now and in the reader's locale, so the server's render can't match exactly. */}
        <time dateTime={new Date(profile.updatedAt).toISOString()} suppressHydrationWarning>
          Updated {formatUpdated(profile.updatedAt)}
        </time>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{format.number(profile.systemPrompt.length)} characters</span>
      </p>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{profile.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {defaultPlaces.length > 0
                ? `New chats in ${defaultPlaces.map((place) => place.title).join(", ")} will start without a profile. `
                : ""}
              Threads that used it keep their messages but stop sending its instruction. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              Delete profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
