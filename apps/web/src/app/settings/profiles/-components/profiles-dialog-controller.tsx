import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

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

type ProfilesDialogControllerProps = {
  ref?: React.Ref<ProfilesDialogControllerHandle>;
  createProfile: (args: CreateProfileArgs) => Promise<Id<"profiles">>;
  updateProfile: (args: UpdateProfileArgs) => Promise<null>;
  onAfterSubmit: () => void;
};

export function ProfilesDialogController({
  ref,
  createProfile,
  updateProfile,
  onAfterSubmit,
}: ProfilesDialogControllerProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileEditSeed | null>(null);

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const filePreviewUrlRef = useRef<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (filePreviewUrlRef.current) URL.revokeObjectURL(filePreviewUrlRef.current);
    };
  }, []);

  const updateFile = useCallback(function updateFile(nextFile: File | null) {
    if (filePreviewUrlRef.current) URL.revokeObjectURL(filePreviewUrlRef.current);

    const nextPreviewUrl = nextFile ? URL.createObjectURL(nextFile) : null;
    filePreviewUrlRef.current = nextPreviewUrl;
    setFilePreviewUrl(nextPreviewUrl);
    setFile(nextFile);
  }, []);

  const openCreate = useCallback(function openCreate() {
    setEditing(null);
    setName("");
    setSystemPrompt("");
    updateFile(null);
    setOpen(true);
  }, [updateFile]);

  const openEdit = useCallback(function openEdit(seed: ProfileEditSeed) {
    setEditing(seed);
    setName(seed.name);
    setSystemPrompt(seed.systemPrompt);
    updateFile(null);
    setOpen(true);
  }, [updateFile]);

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
        const uploadInput = file ? { file } : null;

        if (file && !uploadInput) {
          console.error("[AI Profiles] submit error:", new Error("Not authenticated"));
          setIsSubmitting(false);
          return;
        }

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
          const imageKey = uploadInput ? await uploadAiProfileImage(uploadInput.file) : undefined;
          await saveProfile(imageKey);

          setOpen(false);
          setEditing(null);
          setName("");
          setSystemPrompt("");
          updateFile(null);
          onAfterSubmit();
        } catch (e) {
          console.error("[AI Profiles] submit error:", e);
        }

        setIsSubmitting(false);
      })();
    },
    [createProfile, editing, file, name, onAfterSubmit, systemPrompt, updateFile, updateProfile],
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) updateFile(null);
  }

  return (
    <ProfileDialog
      open={open}
      onOpenChange={handleOpenChange}
      editing={editing}
      name={name}
      onNameChange={setName}
      systemPrompt={systemPrompt}
      onSystemPromptChange={setSystemPrompt}
      file={file}
      onFileChange={updateFile}
      filePreviewUrl={filePreviewUrl}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  );
}
