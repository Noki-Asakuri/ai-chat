import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { FolderIcon, ImagePlusIcon, InboxIcon, Trash2Icon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";

import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

import { uploadAiProfileImage } from "@/lib/convex/upload-files";
import type { LibraryProfile, ProfileLibrary } from "@/lib/profiles/profile-library";
import { cn, format, tryCatch } from "@/lib/utils";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter a profile name."),
  systemPrompt: z.string().trim().min(1, "Enter a system prompt."),
});

type ImageChange = { kind: "keep" } | { kind: "remove" } | { kind: "replace"; file: File; previewUrl: string };

type DefaultFor = { ungrouped: boolean; groupIds: Array<Id<"groups">> };

function getInitialDefaults(library: ProfileLibrary, profile: LibraryProfile | null): DefaultFor {
  if (!profile) return { ungrouped: false, groupIds: [] };
  return {
    ungrouped: library.ungroupedProfileId === profile._id,
    groupIds: library.groups.filter((group) => group.profileId === profile._id).map((group) => group._id),
  };
}

export function ProfileEditorDialog({
  open,
  onOpenChange,
  profile,
  library,
  session,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The profile to edit, or null to create one. */
  profile: LibraryProfile | null;
  library: ProfileLibrary;
  /** Changes on every open, so each one starts from the profile as it is now. */
  session: number;
}) {
  // A save in progress must finish in the dialog it started in, so it can't be dismissed meanwhile.
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy || nextOpen) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 text-sm sm:max-w-2xl">
        <ProfileEditorForm
          key={session}
          profile={profile}
          library={library}
          onBusyChange={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProfileEditorForm({
  profile,
  library,
  onBusyChange,
  onDone,
}: {
  profile: LibraryProfile | null;
  library: ProfileLibrary;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createProfile = useMutation(api.functions.profiles.createProfile);
  const updateProfile = useMutation(api.functions.profiles.updateProfile);
  const discardProfileImage = useMutation(api.functions.profiles.discardProfileImage);

  const [image, setImage] = useState<ImageChange>({ kind: "keep" });
  // What the editor showed when it opened, so saving sends only the places changed here.
  const [initialDefaults] = useState<DefaultFor>(() => getInitialDefaults(library, profile));
  const [defaultFor, setDefaultFor] = useState<DefaultFor>(initialDefaults);

  useEffect(
    () => () => {
      if (image.kind === "replace") URL.revokeObjectURL(image.previewUrl);
    },
    [image],
  );

  const form = useForm({
    defaultValues: { name: profile?.name ?? "", systemPrompt: profile?.systemPrompt ?? "" },
    // Validate on change but only reveal errors after blur or a submit attempt.
    validators: { onMount: profileSchema, onChange: profileSchema, onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      onBusyChange(true);
      let uploadedKey: string | undefined;
      try {
        if (image.kind === "replace") uploadedKey = await uploadAiProfileImage(image.file);
        const imageKey = image.kind === "replace" ? uploadedKey : image.kind === "remove" ? null : undefined;
        // A group deleted while the editor was open has no checkbox anymore; leave it out.
        const liveGroupIds = new Set(library.groups.map((group) => group._id));
        const defaultChanges = getDefaultChanges(initialDefaults, defaultFor, liveGroupIds);

        if (profile) {
          await updateProfile({
            profileId: profile._id,
            name: value.name,
            systemPrompt: value.systemPrompt,
            imageKey,
            defaultChanges,
          });
          toast.success(`Saved “${value.name.trim()}”`);
        } else {
          await createProfile({
            name: value.name,
            systemPrompt: value.systemPrompt,
            imageKey: imageKey ?? undefined,
            defaultChanges,
          });
          toast.success(`Created “${value.name.trim()}”`);
        }
        onBusyChange(false);
        onDone();
      } catch (error) {
        onBusyChange(false);
        // The save never pointed a profile at the new image, so don't leave it in storage.
        if (uploadedKey) {
          const [, discardError] = await tryCatch(discardProfileImage({ imageKey: uploadedKey }));
          if (discardError) console.error("[Profiles] Failed to discard an unused image", discardError);
        }
        toast.error("Couldn't save the profile", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const submitAttempted = useStore(form.store, (state) => state.submissionAttempts > 0);
  const name = useStore(form.store, (state) => state.values.name);

  const hasStoredImage = Boolean(profile?.imageKey) && image.kind === "keep";
  const previewSrc = image.kind === "replace" ? image.previewUrl : undefined;
  const showsImage = hasStoredImage || image.kind === "replace";

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file", { description: "PNG, JPG, WebP or GIF." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That image is too large", {
        description: `Choose one under ${format.size(MAX_IMAGE_BYTES)}.`,
      });
      return;
    }
    setImage({ kind: "replace", file, previewUrl: URL.createObjectURL(file) });
  }

  function toggleGroup(groupId: Id<"groups">, checked: boolean) {
    setDefaultFor((current) => ({
      ...current,
      groupIds: checked
        ? [...current.groupIds, groupId]
        : current.groupIds.filter((id) => id !== groupId),
    }));
  }

  return (
    <>
      <DialogHeader className="border-b px-5 pt-5 pb-4">
        <DialogTitle className="text-base">{profile ? "Edit profile" : "New profile"}</DialogTitle>
        <DialogDescription>
          A profile is a reusable persona: its instruction is sent ahead of your messages whenever it's
          selected.
        </DialogDescription>
      </DialogHeader>

      <form
        id={formId}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3 sm:flex-col sm:items-center">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => fileInputRef.current?.click()}
              aria-label={showsImage ? "Replace profile image" : "Add profile image"}
              className="group/avatar relative shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
            >
              <ProfileAvatar
                name={name || "?"}
                imageKey={hasStoredImage ? profile?.imageKey : undefined}
                src={previewSrc}
                className="size-20"
                fallbackClassName="text-xl"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
                <ImagePlusIcon aria-hidden="true" className="size-5" />
              </span>
            </button>

            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isSubmitting}
                onClick={() => fileInputRef.current?.click()}
              >
                {showsImage ? "Replace" : "Upload"}
              </Button>
              {showsImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={isSubmitting}
                  aria-label="Remove image"
                  title="Remove image"
                  onClick={() => setImage(profile?.imageKey ? { kind: "remove" } : { kind: "keep" })}
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          <form.Field name="name">
            {(field) => {
              const invalid = (field.state.meta.isBlurred || submitAttempted) && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalid} className="min-w-0 flex-1">
                  <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
                  <Input
                    id={`${formId}-name`}
                    name={field.name}
                    value={field.state.value}
                    disabled={isSubmitting}
                    autoComplete="off"
                    aria-invalid={invalid}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    // Caps typing only: an older, longer name still saves unchanged.
                    maxLength={80}
                    placeholder="e.g. Code reviewer"
                    className="h-10 bg-input/30 text-sm"
                  />
                  {invalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : (
                    <FieldDescription>Shown in the profile picker and on messages it answers.</FieldDescription>
                  )}
                </Field>
              );
            }}
          </form.Field>
        </div>

        <form.Field name="systemPrompt">
          {(field) => {
            const invalid = (field.state.meta.isBlurred || submitAttempted) && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalid}>
                <div className="flex items-baseline justify-between gap-2">
                  <FieldLabel htmlFor={`${formId}-prompt`}>Instruction</FieldLabel>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {format.number(field.state.value.length)} characters
                  </span>
                </div>
                <Textarea
                  id={`${formId}-prompt`}
                  name={field.name}
                  value={field.state.value}
                  disabled={isSubmitting}
                  aria-invalid={invalid}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="You are a meticulous code reviewer. Point out bugs before style…"
                  className="max-h-[50dvh] min-h-48 resize-y bg-input/30 font-mono text-[13px] leading-relaxed"
                />
                {invalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : (
                  <FieldDescription>
                    Takes priority over your global instruction when the two disagree.
                  </FieldDescription>
                )}
              </Field>
            );
          }}
        </form.Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Default for new chats in</legend>
          <p className="mb-1 text-xs text-muted-foreground">
            New chats in these groups start with this profile. You can still pick another in the chat.
          </p>

          <div className="overflow-hidden rounded-md border">
            <GroupDefaultRow
              icon={<InboxIcon aria-hidden="true" className="size-4" />}
              title="Ungrouped"
              checked={defaultFor.ungrouped}
              disabled={isSubmitting}
              currentHolder={holderName(library, library.ungroupedProfileId, profile)}
              onCheckedChange={(checked) => setDefaultFor((current) => ({ ...current, ungrouped: checked }))}
            />
            {library.groups.map((group) => (
              <GroupDefaultRow
                key={group._id}
                icon={<FolderIcon aria-hidden="true" className="size-4" />}
                title={group.title}
                checked={defaultFor.groupIds.includes(group._id)}
                disabled={isSubmitting}
                currentHolder={holderName(library, group.profileId, profile)}
                onCheckedChange={(checked) => toggleGroup(group._id, checked)}
              />
            ))}
          </div>
          {library.groups.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Create groups from the chat sidebar to give each its own default.
            </p>
          )}
        </fieldset>
      </form>

      <DialogFooter className="m-0 rounded-b-md border-t bg-muted/30 px-5 py-3">
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {profile ? "Save changes" : "Create profile"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** The places whose checkbox changed since the editor opened. */
function getDefaultChanges(initial: DefaultFor, next: DefaultFor, liveGroupIds: ReadonlySet<Id<"groups">>) {
  const before = new Set(initial.groupIds);
  const after = new Set(next.groupIds);
  return {
    ungrouped: initial.ungrouped === next.ungrouped ? undefined : next.ungrouped,
    addGroupIds: next.groupIds.filter((id) => !before.has(id) && liveGroupIds.has(id)),
    removeGroupIds: initial.groupIds.filter((id) => !after.has(id) && liveGroupIds.has(id)),
  };
}

/** The other profile that is the default here now, which saving this one would replace. */
function holderName(
  library: ProfileLibrary,
  holderId: Id<"profiles"> | null,
  editing: LibraryProfile | null,
): string | null {
  if (!holderId || holderId === editing?._id) return null;
  return library.profiles.find((item) => item._id === holderId)?.name ?? null;
}

function GroupDefaultRow({
  icon,
  title,
  checked,
  disabled,
  currentHolder,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  title: string;
  checked: boolean;
  disabled: boolean;
  currentHolder: string | null;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- The checkbox is nested in the label.
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors not-first:border-t hover:bg-muted/40",
        checked && "bg-primary/6",
      )}
    >
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
      {currentHolder && (
        <span className="max-w-[45%] truncate text-xs text-muted-foreground">
          {checked ? `Replaces ${currentHolder}` : `Now: ${currentHolder}`}
        </span>
      )}
    </label>
  );
}
