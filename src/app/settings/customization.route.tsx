import { api } from "@/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { useSessionMutation } from "convex-helpers/react/sessions";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { ComponentPropsWithoutRef, FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { useStorage } from "@/lib/hooks/use-storage";

import { BackgroundCard } from "./-components/customization/background-card";
import { BehaviorOptionsCard } from "./-components/customization/behavior-options-card";

export const Route = createFileRoute("/settings/customization")({
  component: RouteComponent,
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
  const { data, isPending } = useSuspenseQuery(convexSessionQuery(api.functions.users.currentUser));
  const updateUserCustomization = useSessionMutation(api.functions.users.updateUserCustomization);

  const { uploadFile, deleteFile } = useStorage();

  const [pendingUpdate, startTransition] = useTransition();

  const disabled = pendingUpdate || isPending;
  const existingBackgroundId = data?.customization?.backgroundId ?? null;

  async function removeExistingBackground() {
    if (!existingBackgroundId) return;

    await updateUserCustomization({ data: { backgroundId: null } });
    await deleteFile(existingBackgroundId);
  }

  function handleUpdateUserCustomization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const name = getFormString("name", formData);
    const occupation = getFormString("occupation", formData);
    const traitsRaw = getFormString("traits", formData);
    const systemInstruction = getFormString("system-instruction", formData);

    const file = getFormFile("background-image", formData);

    const disableBlur = getFormString("disable-blur", formData) === "on";
    const showFullCode = getFormString("show-full-code", formData) === "on";

    const traits = traitsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startTransition(async function () {
      const updates: {
        name: string;
        occupation: string;
        traits: string[];
        systemInstruction: string;
        backgroundId?: string | null;
        disableBlur: boolean;
        showFullCode: boolean;
      } = {
        name,
        occupation,
        traits,
        systemInstruction,
        disableBlur,
        showFullCode,
      };

      if (file && file.size > 0) {
        if (existingBackgroundId) {
          await deleteFile(existingBackgroundId);
        }

        updates.backgroundId = await uploadFile({ file });
      }

      toast.promise(updateUserCustomization({ data: updates }), {
        loading: "Saving preferences...",
        success: "Preferences saved",
        error: "Failed to save preferences",
      });
    });
  }

  return (
    <div className="space-y-6">
      <form className="space-y-6" onSubmit={handleUpdateUserCustomization}>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>Basic information used to personalize responses.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">What should AI call you?</Label>
                <ControlledInput
                  id="name"
                  name="name"
                  autoComplete="off"
                  placeholder="Enter your name"
                  className="bg-input/30"
                  disabled={disabled}
                  defaultValue={data?.customization?.name ?? ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupation">What do you do?</Label>
                <ControlledInput
                  id="occupation"
                  name="occupation"
                  autoComplete="off"
                  placeholder="Engineer, student, etc."
                  className="bg-input/30"
                  disabled={disabled}
                  defaultValue={data?.customization?.occupation ?? ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="traits">What traits should AI have?</Label>
              <ControlledInput
                id="traits"
                name="traits"
                autoComplete="off"
                placeholder="Friendly, concise, detail-oriented..."
                className="bg-input/30"
                disabled={disabled}
                defaultValue={data?.customization?.traits?.join(", ") ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Separate traits with commas (e.g., “concise, direct, empathetic”).
              </p>
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
              disabled={disabled}
              defaultValue={
                data?.customization?.systemInstruction ?? "You are a helpful assistant."
              }
            />
          </CardContent>
        </Card>

        <BehaviorOptionsCard
          disabled={disabled}
          defaultDisableBlur={data?.customization?.disableBlur ?? false}
          defaultShowFullCode={data?.customization?.showFullCode ?? false}
        />

        <BackgroundCard
          disabled={disabled}
          existingBackgroundId={existingBackgroundId}
          onRemoveExistingBackground={removeExistingBackground}
        />

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={disabled}>
            Save preferences
          </Button>
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
