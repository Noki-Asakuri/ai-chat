import { useForm, useStore } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

import type { ProfileEditSeed } from "./profiles-dialog-controller";

type ProfileFormValues = {
  name: string;
  systemPrompt: string;
  file: File | null;
};

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter a profile name."),
  systemPrompt: z.string().trim().min(1, "Enter a system prompt."),
  file: z.file().nullable(),
});

export function ProfileDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ProfileEditSeed | null;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
}) {
  const defaultValues: ProfileFormValues = {
    name: editing?.name ?? "",
    systemPrompt: editing?.systemPrompt ?? "",
    file: null,
  };
  const form = useForm({
    defaultValues,
    // Errors from onBlur persist until the next blur, so a corrected field would block the first submit.
    // Validate on change instead and only reveal errors after blur or a submit attempt.
    validators: { onMount: profileSchema, onChange: profileSchema, onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value);
      } catch (error) {
        toast.error("Failed to save profile", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
  });
  const file = useStore(form.store, (state) => state.values.file);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const submitAttempted = useStore(form.store, (state) => state.submissionAttempts > 0);
  const [preview, setPreview] = useState<string | null>(null);
  const filePreviewUrl = preview;

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className="data-[size=default]:max-w-[min(92vw,42rem)] data-[size=default]:sm:max-w-4xl data-[size=default]:lg:max-w-5xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{editing ? "Edit Profile" : "Create Profile"}</AlertDialogTitle>
        </AlertDialogHeader>

        <form
          id="profile-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="grid gap-4 py-2 md:grid-cols-[12rem_1fr]">
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-md border bg-muted/30">
                {filePreviewUrl ? (
                  <div className="relative aspect-square w-full">
                    <img
                      src={filePreviewUrl}
                      alt="Selected profile preview"
                      className="absolute inset-0 size-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/25 to-transparent p-2">
                      <div className="text-xs font-medium text-white">Image preview</div>
                      <div className="text-xs text-white/80">
                        <span className="block truncate" title={file?.name ?? ""}>
                          {file?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 p-3 text-center">
                    <div className="text-xs font-medium">Image</div>
                    <div className="text-xs text-muted-foreground">Optional</div>
                  </div>
                )}
              </div>
              <form.Field name="file">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="profile-image">Profile image</FieldLabel>
                    <Input
                      id="profile-image"
                      name={field.name}
                      type="file"
                      accept="image/*"
                      disabled={isSubmitting}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0] ?? null;
                        field.handleChange(selectedFile);
                        setPreview(selectedFile ? URL.createObjectURL(selectedFile) : null);
                      }}
                    />
                    <FieldDescription>PNG, JPG, or WebP.</FieldDescription>
                  </Field>
                )}
              </form.Field>
            </div>
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const invalid =
                    (field.state.meta.isBlurred || submitAttempted) && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor="profile-name">Name (required)</FieldLabel>
                      <Input
                        id="profile-name"
                        name={field.name}
                        required
                        value={field.state.value}
                        disabled={isSubmitting}
                        aria-invalid={invalid}
                        aria-describedby={invalid ? "profile-name-error" : undefined}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="e.g. Helpful Researcher"
                      />
                      {invalid && <FieldError id="profile-name-error" errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field name="systemPrompt">
                {(field) => {
                  const invalid =
                    (field.state.meta.isBlurred || submitAttempted) && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor="profile-system-prompt">System prompt (required)</FieldLabel>
                      <Textarea
                        id="profile-system-prompt"
                        name={field.name}
                        required
                        value={field.state.value}
                        disabled={isSubmitting}
                        aria-invalid={invalid}
                        aria-describedby="profile-prompt-description profile-prompt-error"
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        rows={10}
                        className="min-h-48 rounded-md"
                        placeholder="Describe how this AI should behave…"
                      />
                      <FieldDescription id="profile-prompt-description">
                        This is the main instruction that shapes the persona.
                      </FieldDescription>
                      {invalid && <FieldError id="profile-prompt-error" errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button type="submit" disabled={isSubmitting}>
              {editing ? "Save" : "Create"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
