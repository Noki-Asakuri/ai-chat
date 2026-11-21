import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useImperativeHandle, useState } from "react";

import { uploadAiProfileImage } from "@/lib/convex/upload-files";

import { ProfileDialog } from "./profile-dialog";

export type ProfileEditSeed = {
  id: Id<"profiles">;
  name: string;
  systemPrompt: string;
};

type CreateProfileArgs = {
  name: string;
  systemPrompt: string;
  imageKey?: string;
};

type UpdateProfileArgs = CreateProfileArgs & {
  profileId: Id<"profiles">;
};

export type ProfilesDialogControllerHandle = {
  openCreate: () => void;
  openEdit: (seed: ProfileEditSeed) => void;
};

type ProfilesDialogControllerProps = {
  ref?: React.Ref<ProfilesDialogControllerHandle>;
  createProfile: (args: CreateProfileArgs) => Promise<Id<"profiles">>;
  updateProfile: (args: UpdateProfileArgs) => Promise<null>;
};

export function ProfilesDialogController({
  ref,
  createProfile,
  updateProfile,
}: ProfilesDialogControllerProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileEditSeed | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      openCreate() {
        setEditing(null);
        setOpen(true);
      },
      openEdit(seed) {
        setEditing(seed);
        setOpen(true);
      },
    }),
    [],
  );

  if (!open) return null;

  return (
    <ProfileDialog
      open={open}
      onOpenChange={setOpen}
      editing={editing}
      onSubmit={async ({ name, systemPrompt, file }) => {
        const imageKey = file ? await uploadAiProfileImage(file) : undefined;
        if (editing) {
          await updateProfile({ profileId: editing.id, name, systemPrompt, imageKey });
        } else {
          await createProfile({ name, systemPrompt, imageKey });
        }
        setOpen(false);
      }}
    />
  );
}
