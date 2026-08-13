import { api } from "@ai-chat/backend/convex/_generated/api";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { useDebounce } from "@uidotdev/usehooks";
import { useMutation } from "convex/react";
import type { ComponentPropsWithoutRef } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

import { SettingsSection } from "@/components/settings/settings-section";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { tryCatch } from "@/lib/utils";

import { AutosaveStatus } from "../-components/autosave-status";

import { LoadingCustomizationSkeleton } from "./-pending";

export const Route = createFileRoute("/settings/customization")({
  component: RouteComponent,
  pendingComponent: LoadingCustomizationSkeleton,
  head: () => ({ meta: [{ title: "Customization - AI Chat" }] }),
});

function getFormString(key: string, formData: FormData): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function RouteComponent() {
  const { data, isPending } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );
  const updateUserPreferences = useMutation(api.functions.users.updateUserPreferences);

  const [saveRequestCount, setSaveRequestCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const debouncedSaveRequestCount = useDebounce(saveRequestCount, 700);

  const formRef = useRef<HTMLFormElement>(null);
  const isSavingRef = useRef(false);
  const hasPendingSaveRef = useRef(false);
  const runAutoSaveRef = useRef<(() => Promise<void>) | null>(null);

  const requestAutoSave = useCallback(() => {
    setSaveRequestCount((count) => count + 1);
  }, []);

  const savePreferencesFromForm = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    await updateUserPreferences({
      data: {
        name: getFormString("name", formData),
        globalSystemInstruction: getFormString("system-instruction", formData),
      },
    });
  }, [updateUserPreferences]);

  const runAutoSave = useCallback(async () => {
    if (isSavingRef.current) {
      hasPendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    while (true) {
      hasPendingSaveRef.current = false;

      const [, error] = await tryCatch(savePreferencesFromForm());
      if (error) {
        toast.error("Failed to save preferences", {
          id: "customization-autosave-error",
          description: error.message,
        });
      }

      if (!hasPendingSaveRef.current) break;
    }

    isSavingRef.current = false;
    setIsSaving(false);
  }, [savePreferencesFromForm]);

  useEffect(() => {
    runAutoSaveRef.current = runAutoSave;
  }, [runAutoSave]);

  useEffect(() => {
    if (debouncedSaveRequestCount < 1) return;
    void runAutoSaveRef.current?.();
  }, [debouncedSaveRequestCount]);

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} onChangeCapture={requestAutoSave}>
      <SettingsSection
        id="personal-context"
        title="Personal context"
        description="Give the assistant a small amount of context it can use in every conversation."
        actions={<AutosaveStatus isSaving={isSaving} />}
      >
        <FieldGroup className="gap-0">
          <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:gap-x-8">
            <FieldContent>
              <FieldLabel htmlFor="name">What should AI call you?</FieldLabel>
              <FieldDescription>Your preferred name or nickname.</FieldDescription>
            </FieldContent>
            <ControlledInput
              id="name"
              name="name"
              autoComplete="off"
              placeholder="Enter your name"
              className="h-10 bg-input/30 text-sm"
              disabled={isPending}
              defaultValue={data?.name ?? ""}
            />
          </Field>

          <Separator />

          <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:gap-x-8">
            <FieldContent>
              <FieldLabel htmlFor="system-instruction">Global instruction</FieldLabel>
              <FieldDescription>
                Applied to every new conversation unless a profile provides more specific guidance.
              </FieldDescription>
            </FieldContent>
            <ControlledTextarea
              autoComplete="off"
              id="system-instruction"
              name="system-instruction"
              className="min-h-48 resize-y bg-input/30"
              disabled={isPending}
              defaultValue={data?.globalSystemInstruction ?? "You are a helpful assistant."}
            />
          </Field>
        </FieldGroup>
        <p className="border-t pt-4 text-xs text-muted-foreground">Changes save automatically.</p>
      </SettingsSection>
    </form>
  );
}

function ControlledInput({
  defaultValue,
  ...props
}: ComponentPropsWithoutRef<typeof Input> & { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");

  useEffect(() => {
    setValue(defaultValue ?? "");
  }, [defaultValue]);

  return <Input type="text" value={value} onValueChange={setValue} {...props} />;
}

function ControlledTextarea({
  defaultValue,
  ...props
}: ComponentPropsWithoutRef<typeof Textarea> & { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");

  useEffect(() => {
    setValue(defaultValue ?? "");
  }, [defaultValue]);

  return <Textarea value={value} onChange={(event) => setValue(event.target.value)} {...props} />;
}
