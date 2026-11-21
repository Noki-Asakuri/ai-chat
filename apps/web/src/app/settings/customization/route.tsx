import { api } from "@ai-chat/backend/convex/_generated/api";

import { useForm } from "@tanstack/react-form";
import { useMutation as useQueryMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useBlocker } from "@tanstack/react-router";

import { useMutation } from "convex/react";
import { toast } from "@/components/ui/toast";

import { SettingsSection } from "@/components/settings/settings-section";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { convexQuery } from "@convex-dev/react-query";
import { Button } from "@/components/ui/button";

import { AutosaveStatus } from "../-components/autosave-status";
import { flushAutosave } from "../-components/flush-autosave";

import { LoadingCustomizationSkeleton } from "./-pending";

export const Route = createFileRoute("/settings/customization")({
  loader: async ({ context }) => {
    await context.queryClient.query(convexQuery(api.functions.users.getCurrentUserPreferences));
  },
  component: RouteComponent,
  pendingComponent: LoadingCustomizationSkeleton,
  head: () => ({ meta: [{ title: "Customization - AI Chat" }] }),
});

function RouteComponent() {
  const { data } = useSuspenseQuery(convexQuery(api.functions.users.getCurrentUserPreferences));
  const updateUserPreferences = useMutation(api.functions.users.updateUserPreferences);
  const defaultValues = {
    name: data.name ?? "",
    globalSystemInstruction: data.globalSystemInstruction ?? "You are a helpful assistant.",
  };
  const save = useQueryMutation({
    scope: { id: "personal-context" },
    mutationFn: async (values: typeof defaultValues) => {
      await updateUserPreferences({ data: values });
      return values;
    },
    onError: (error) => {
      toast.error("Failed to save preferences", {
        id: "customization-autosave-error",
        description: error.message,
      });
    },
  });
  const form = useForm({
    defaultValues,
    listeners: {
      onChangeDebounceMs: 700,
      onChange: ({ formApi }) => save.mutate(formApi.state.values),
    },
    onSubmit: ({ value }) => save.mutate(value),
  });
  const savedValues = save.data ?? defaultValues;

  useBlocker({
    shouldBlockFn: async () => {
      const values = form.state.values;
      if (
        !save.isPending &&
        values.name === savedValues.name &&
        values.globalSystemInstruction === savedValues.globalSystemInstruction
      )
        return false;
      try {
        await flushAutosave({ getValues: () => form.state.values, save: save.mutateAsync });
        return false;
      } catch {
        return true;
      }
    },
    enableBeforeUnload: () =>
      save.isPending ||
      form.state.values.name !== savedValues.name ||
      form.state.values.globalSystemInstruction !== savedValues.globalSystemInstruction,
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SettingsSection
        id="personal-context"
        title="Personal context"
        description="Give the assistant a small amount of context it can use in every conversation."
        actions={
          <form.Subscribe selector={(state) => state.values}>
            {(values) =>
              save.isError ? (
                <Button type="submit" variant="outline" size="sm">
                  Retry saving
                </Button>
              ) : (
                <AutosaveStatus
                  isSaving={
                    save.isPending ||
                    values.name !== savedValues.name ||
                    values.globalSystemInstruction !== savedValues.globalSystemInstruction
                  }
                />
              )
            }
          </form.Subscribe>
        }
      >
        <FieldGroup className="gap-0">
          <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:gap-x-8">
            <FieldContent>
              <FieldLabel htmlFor="name">What should AI call you?</FieldLabel>
              <FieldDescription>Your preferred name or nickname.</FieldDescription>
            </FieldContent>

            <form.Field name="name">
              {(field) => (
                <Input
                  id="name"
                  name={field.name}
                  autoComplete="nickname"
                  placeholder="Enter your name"
                  className="h-10 bg-input/30 text-sm"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              )}
            </form.Field>
          </Field>

          <Separator />

          <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:gap-x-8">
            <FieldContent>
              <FieldLabel htmlFor="system-instruction">Global instruction</FieldLabel>
              <FieldDescription>
                Applied to every new conversation unless a profile provides more specific guidance.
              </FieldDescription>
            </FieldContent>

            <form.Field name="globalSystemInstruction">
              {(field) => (
                <Textarea
                  id="system-instruction"
                  name={field.name}
                  autoComplete="off"
                  className="min-h-48 resize-y bg-input/30"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              )}
            </form.Field>
          </Field>
        </FieldGroup>
        <p className="border-t pt-4 text-xs text-muted-foreground">Changes save automatically.</p>
      </SettingsSection>
    </form>
  );
}
