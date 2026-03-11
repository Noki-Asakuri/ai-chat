import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { EditIcon, Trash2Icon } from "lucide-react";
import { memo } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildImageAssetUrl } from "@/lib/assets/urls";

export type ProfileListItem = {
  _id: Id<"profiles">;
  name: string;
  systemPrompt: string;
  imageKey?: string;
  createdAt: number;
  updatedAt: number;
};

type ProfileEditSeed = {
  id: Id<"profiles">;
  name: string;
  systemPrompt: string;
};

export const ProfileCard = memo(function ProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: ProfileListItem;
  onEdit: (seed: ProfileEditSeed) => void;
  onDelete: (id: Id<"profiles">) => void;
}) {
  const imageUrl =
    profile.imageKey && profile.imageKey.length > 0 ? buildImageAssetUrl(profile.imageKey) : null;

  const shortDesc =
    profile.systemPrompt.length > 140
      ? profile.systemPrompt.slice(0, 140) + "…"
      : profile.systemPrompt;

  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">{profile.name}</CardTitle>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              onEdit({ id: profile._id, name: profile.name, systemPrompt: profile.systemPrompt })
            }
            title="Edit"
          >
            <EditIcon className="size-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" size="icon" />}
              className="h-8 w-8"
              title="Delete"
              type="button"
            >
              <Trash2Icon className="size-4" />
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{profile.name}”?</AlertDialogTitle>
              </AlertDialogHeader>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete this AI profile.
              </p>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(profile._id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="flex items-start gap-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={profile.name}
            className="h-16 w-16 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-md bg-muted" />
        )}

        <div className="text-sm text-foreground/80">{shortDesc || "No description"}</div>
      </CardContent>
    </Card>
  );
});
