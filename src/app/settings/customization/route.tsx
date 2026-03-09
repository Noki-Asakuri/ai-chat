import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { useSessionMutation } from "convex-helpers/react/sessions";

import { useDebounce } from "@uidotdev/usehooks";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { ComponentPropsWithoutRef } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { SendPreference } from "@/lib/chat/send-preference";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { useStorage } from "@/lib/hooks/use-storage";
import { tryCatch } from "@/lib/utils";

import { BackgroundCard } from "../-components/customization/background-card";
import { BehaviorOptionsCard } from "../-components/customization/behavior-options-card";

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

function getFormFile(key: string, formData: FormData): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function RouteComponent() {
  const { data, isPending } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );

  const updateUserPreferences = useSessionMutation(api.functions.users.updateUserPreferences);
  const { uploadFile, deleteFile } = useStorage();

  const [sendPreference, setSendPreference] = useState<SendPreference>(
    data?.sendPreference ?? "enter",
  );
  const [backgroundImageId, setBackgroundImageId] = useState<string | null>(
    data?.backgroundImage ?? null,
  );
  const [saveRequestCount, setSaveRequestCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSaveRequestCount = useDebounce(saveRequestCount, 700);

  const formRef = useRef<HTMLFormElement>(null);
  const isSavingRef = useRef(false);
  const hasPendingSaveRef = useRef(false);
  const backgroundIdRef = useRef<string | null>(data?.backgroundImage ?? null);
  const sendPreferenceRef = useRef<SendPreference>(data?.sendPreference ?? "enter");
  const runAutoSaveRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    setSendPreference(data?.sendPreference ?? "enter");
  }, [data?.sendPreference]);

  useEffect(() => {
    sendPreferenceRef.current = sendPreference;
  }, [sendPreference]);

  useEffect(() => {
    setBackgroundImageId(data?.backgroundImage ?? null);
  }, [data?.backgroundImage]);

  useEffect(() => {
    backgroundIdRef.current = backgroundImageId;
  }, [backgroundImageId]);

  const requestAutoSave = useCallback(() => {
    setSaveRequestCount((count) => count + 1);
  }, []);

  const savePreferencesFromForm = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);

    const name = getFormString("name", formData);
    const systemInstruction = getFormString("system-instruction", formData);

    const performanceEnabled = getFormString("performance-mode", formData) === "on";
    const showFullCode = getFormString("show-full-code", formData) === "on";
    const autoWrap = getFormString("auto-wrap", formData) === "on";

    const previousBackgroundId = backgroundIdRef.current;
    const nextBackgroundFile = getFormFile("background-image", formData);

    let uploadedBackgroundId: string | null = null;
    if (nextBackgroundFile && nextBackgroundFile.size > 0) {
      uploadedBackgroundId = await uploadFile({ file: nextBackgroundFile });
    }

    const updates: Partial<Doc<"users">["preferences"]> = {
      name,
      globalSystemInstruction: systemInstruction,
      performanceEnabled,
      sendPreference: sendPreferenceRef.current,
      code: { showFullCode, autoWrap },
      backgroundImage: uploadedBackgroundId ?? previousBackgroundId,
    };

    const [, updateError] = await tryCatch(updateUserPreferences({ data: updates }));
    if (updateError) {
      if (uploadedBackgroundId) {
        await deleteFile(uploadedBackgroundId);
      }

      throw updateError;
    }

    if (!uploadedBackgroundId) return;

    backgroundIdRef.current = uploadedBackgroundId;
    setBackgroundImageId(uploadedBackgroundId);

    if (previousBackgroundId && previousBackgroundId !== uploadedBackgroundId) {
      await deleteFile(previousBackgroundId);
    }

    const backgroundInput = form.elements.namedItem("background-image");
    if (backgroundInput instanceof HTMLInputElement) {
      backgroundInput.value = "";
    }
  }, [deleteFile, updateUserPreferences, uploadFile]);

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

      if (!hasPendingSaveRef.current) {
        break;
      }
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

  async function removeExistingBackground() {
    const existingBackgroundId = backgroundIdRef.current;
    if (!existingBackgroundId) return;

    await updateUserPreferences({ data: { backgroundImage: null } });
    await deleteFile(existingBackgroundId);

    backgroundIdRef.current = null;
    setBackgroundImageId(null);

    const form = formRef.current;
    if (!form) return;

    const backgroundInput = form.elements.namedItem("background-image");
    if (backgroundInput instanceof HTMLInputElement) {
      backgroundInput.value = "";
    }
  }

  const formDisabled = isPending;

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        className="space-y-6"
        onSubmit={(event) => event.preventDefault()}
        onChangeCapture={requestAutoSave}
      >
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>Basic information used to personalize responses.</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="w-full space-y-2">
              <Label htmlFor="name">What should AI call you?</Label>
              <ControlledInput
                id="name"
                name="name"
                autoComplete="off"
                placeholder="Enter your name"
                className="bg-input/30"
                disabled={formDisabled}
                defaultValue={data?.name ?? ""}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>System instruction</CardTitle>
            <CardDescription>
              A global instruction applied to the assistant across the app.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            <Label htmlFor="system-instruction">Instruction</Label>
            <ControlledTextarea
              autoComplete="off"
              id="system-instruction"
              name="system-instruction"
              className="min-h-[150px]"
              disabled={formDisabled}
              defaultValue={data?.globalSystemInstruction ?? "You are a helpful assistant."}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-start">
          <BehaviorOptionsCard
            disabled={formDisabled}
            defaultAutoWrap={data?.code?.autoWrap ?? false}
            defaultPerformanceEnabled={data?.performanceEnabled ?? false}
            defaultShowFullCode={data?.code?.showFullCode ?? false}
            sendPreference={sendPreference}
            onSendPreferenceChange={setSendPreference}
            onBehaviorChange={requestAutoSave}
          />

          <BackgroundCard
            disabled={formDisabled || isSaving}
            existingBackgroundId={backgroundImageId}
            onRemoveExistingBackground={removeExistingBackground}
          />
        </div>

        <div className="flex items-center justify-end">
          <p className="text-sm text-muted-foreground">
            {isSaving ? "Saving changes..." : "Changes are saved automatically."}
          </p>
        </div>
      </form>
    </div>
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

  return <Input type="text" value={value} onValueChange={(v) => setValue(v)} {...props} />;
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
