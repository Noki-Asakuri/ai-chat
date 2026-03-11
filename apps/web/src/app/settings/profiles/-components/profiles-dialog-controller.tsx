import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";

import { uploadAiProfileImage } from "@/lib/convex/uploadFiles";

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

type UpdateProfileArgs = {
  profileId: Id<"profiles">;
  name: string;
  systemPrompt: string;
  imageKey?: string;
};

export type ProfilesDialogControllerHandle = {
  openCreate: () => void;
  openEdit: (seed: ProfileEditSeed) => void;
};

export const ProfilesDialogController = forwardRef<
  ProfilesDialogControllerHandle,
  {
    sessionId: string | null | undefined;
    createProfile: (args: CreateProfileArgs) => Promise<unknown>;
    updateProfile: (args: UpdateProfileArgs) => Promise<unknown>;
    onAfterSubmit: () => void;
  }
>(function ProfilesDialogController(
  { sessionId, createProfile, updateProfile, onAfterSubmit },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileEditSeed | null>(null);

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const openCreate = useCallback(function openCreate() {
    setEditing(null);
    setName("");
    setSystemPrompt("");
    setFile(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback(function openEdit(seed: ProfileEditSeed) {
    setEditing(seed);
    setName(seed.name);
    setSystemPrompt(seed.systemPrompt);
    setFile(null);
    setOpen(true);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openCreate,
      openEdit,
    }),
    [openCreate, openEdit],
  );

  const handleSubmit = useCallback(
    function handleSubmit() {
      void (async () => {
        if (!name.trim() || !systemPrompt.trim()) return;

        setIsSubmitting(true);
        const uploadInput = file && sessionId ? { file, sessionId } : null;

        if (file && !uploadInput) {
          console.error("[AI Profiles] submit error:", new Error("Not authenticated"));
          setIsSubmitting(false);
          return;
        }

        const uploadImage = uploadInput
          ? function uploadImage() {
              return uploadAiProfileImage(uploadInput.file, uploadInput.sessionId);
            }
          : function uploadImage() {
              return Promise.resolve(undefined);
            };

        const saveProfile = editing
          ? function saveProfile(imageKey: string | undefined) {
              return updateProfile({
                profileId: editing.id,
                name,
                systemPrompt,
                imageKey: imageKey,
              });
            }
          : function saveProfile(imageKey: string | undefined) {
              return createProfile({ name, systemPrompt, imageKey: imageKey });
            };

        try {
          const imageKey = await uploadImage();
          await saveProfile(imageKey);

          setOpen(false);
          setEditing(null);
          setName("");
          setSystemPrompt("");
          setFile(null);
          onAfterSubmit();
        } catch (e) {
          console.error("[AI Profiles] submit error:", e);
        }

        setIsSubmitting(false);
      })();
    },
    [createProfile, editing, file, name, onAfterSubmit, sessionId, systemPrompt, updateProfile],
  );

  return (
    <ProfileDialog
      open={open}
      onOpenChange={setOpen}
      editing={editing}
      name={name}
      onNameChange={setName}
      systemPrompt={systemPrompt}
      onSystemPromptChange={setSystemPrompt}
      file={file}
      onFileChange={setFile}
      filePreviewUrl={filePreviewUrl}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  );
});
