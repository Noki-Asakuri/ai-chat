import { api } from "@ai-chat/backend/convex/_generated/api";

import { useForm, useStore } from "@tanstack/react-form";
import { useMutation as useQueryMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useBlocker } from "@tanstack/react-router";

import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useMutation } from "convex/react";
import type { CSSProperties } from "react";
import { useEffect } from "react";
import { toast } from "@/components/ui/toast";

import { convexQuery } from "@convex-dev/react-query";
import { useStorage } from "@/lib/hooks/use-storage";
import {
  DEFAULT_CODE_FONT,
  DEFAULT_CODE_FONT_SIZE,
  DEFAULT_PROMPT_FONT_SIZE,
  DEFAULT_UI_FONT,
  DEFAULT_UI_FONT_SIZE,
  applyTypography,
  cacheTypography,
  getTypographyStyle,
} from "@/lib/appearance/typography";

import { Button } from "@/components/ui/button";

import { BackgroundCard } from "../-components/customization/background-card";
import { BehaviorOptionsCard } from "../-components/customization/behavior-options-card";
import { FontsCard } from "../-components/customization/fonts-card";
import { AutosaveStatus } from "../-components/autosave-status";

import { LoadingAppearanceSkeleton } from "./-pending";

export const Route = createFileRoute("/settings/appearance")({
  loader: async ({ context }) => {
    await context.queryClient.query(convexQuery(api.functions.users.getCurrentUserPreferences));
  },
  component: RouteComponent,
  pendingComponent: LoadingAppearanceSkeleton,
  head: () => ({ meta: [{ title: "Appearance - AI Chat" }] }),
});

function RouteComponent() {
  const { user } = useAuth({ ensureSignedIn: true });
  const { data } = useSuspenseQuery(convexQuery(api.functions.users.getCurrentUserPreferences));
  const updateUserPreferences = useMutation(api.functions.users.updateUserPreferences);
  const { uploadFile, deleteFile } = useStorage();
  const defaultValues = {
    fonts: {
      ui: data.fonts?.ui ?? DEFAULT_UI_FONT,
      uiSize: data.fonts?.uiSize ?? DEFAULT_UI_FONT_SIZE,
      prompt: data.fonts?.prompt ?? DEFAULT_UI_FONT,
      promptSize: data.fonts?.promptSize ?? DEFAULT_PROMPT_FONT_SIZE,
      code: data.fonts?.code ?? DEFAULT_CODE_FONT,
      codeSize: data.fonts?.codeSize ?? DEFAULT_CODE_FONT_SIZE,
    },
    behavior: {
      sendPreference: data.sendPreference,
      notifications: data.notifications,
      code: data.code,
      performanceEnabled: data.performanceEnabled,
    },
  };
  const save = useQueryMutation({
    scope: { id: "appearance" },
    mutationFn: async (values: typeof defaultValues) => {
      await updateUserPreferences({ data: { fonts: values.fonts, ...values.behavior } });
      return values;
    },
    onError: (error) => {
      toast.error("Failed to save appearance", {
        id: "appearance-autosave-error",
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
  const fonts = useStore(form.store, (state) => state.values.fonts);

  useEffect(() => {
    if (!user) return;
    cacheTypography(user.id, fonts);
    applyTypography(document.documentElement, fonts);
  }, [fonts, user]);

  const background = useQueryMutation({
    scope: { id: "appearance-background" },
    mutationFn: async (file: File | null) => {
      const previousBackgroundId = data.backgroundImage;
      const uploadedBackgroundId = file ? await uploadFile({ file }) : null;
      try {
        await updateUserPreferences({ data: { backgroundImage: uploadedBackgroundId } });
      } catch (error) {
        if (uploadedBackgroundId) await deleteFile(uploadedBackgroundId);
        throw error;
      }
      if (previousBackgroundId && previousBackgroundId !== uploadedBackgroundId) {
        await deleteFile(previousBackgroundId);
      }
    },
    onError: (error) => {
      toast.error("Failed to save background", { description: error.message });
    },
  });
  const savedValues = save.data ?? defaultValues;

  useBlocker({
    shouldBlockFn: async () => {
      if (background.isPending) {
        toast.message("Wait for the background image to finish saving.");
        return true;
      }
      if (!save.isPending && JSON.stringify(form.state.values) === JSON.stringify(savedValues)) return false;
      try {
        await save.mutateAsync(form.state.values);
        return false;
      } catch {
        return true;
      }
    },
    enableBeforeUnload: () =>
      background.isPending ||
      save.isPending ||
      JSON.stringify(form.state.values) !== JSON.stringify(savedValues),
  });
  const customStyle: CSSProperties = getTypographyStyle(fonts);

  return (
    <div className="font-sans" style={customStyle}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">Changes save automatically.</p>
            {save.isError ? (
              <Button type="submit" variant="outline" size="sm">
                Retry saving
              </Button>
            ) : (
              <form.Subscribe selector={(state) => state.values}>
                {(values) => (
                  <AutosaveStatus
                    isSaving={
                      save.isPending ||
                      background.isPending ||
                      JSON.stringify(values) !== JSON.stringify(savedValues)
                    }
                  />
                )}
              </form.Subscribe>
            )}
          </div>
          <form.Field name="fonts">
            {(field) => (
              <FontsCard
                disabled={false}
                uiFont={field.state.value.ui}
                uiFontSize={field.state.value.uiSize}
                promptFont={field.state.value.prompt}
                promptFontSize={field.state.value.promptSize}
                codeFont={field.state.value.code}
                codeFontSize={field.state.value.codeSize}
                onUiFontChange={(ui) => field.handleChange((previous) => ({ ...previous, ui }))}
                onUiFontSizeChange={(uiSize) => field.handleChange((previous) => ({ ...previous, uiSize }))}
                onPromptFontChange={(prompt) => field.handleChange((previous) => ({ ...previous, prompt }))}
                onPromptFontSizeChange={(promptSize) =>
                  field.handleChange((previous) => ({ ...previous, promptSize }))
                }
                onCodeFontChange={(code) => field.handleChange((previous) => ({ ...previous, code }))}
                onCodeFontSizeChange={(codeSize) =>
                  field.handleChange((previous) => ({ ...previous, codeSize }))
                }
              />
            )}
          </form.Field>
          <form.Field name="behavior">
            {(field) => (
              <BehaviorOptionsCard
                disabled={false}
                autoWrap={field.state.value.code.autoWrap}
                performanceEnabled={field.state.value.performanceEnabled}
                showFullCode={field.state.value.code.showFullCode}
                sendPreference={field.state.value.sendPreference}
                notificationSound={field.state.value.notifications.sound}
                desktopNotification={field.state.value.notifications.desktop}
                onSendPreferenceChange={(sendPreference) =>
                  field.handleChange((previous) => ({ ...previous, sendPreference }))
                }
                onNotificationSoundChange={(sound) =>
                  field.handleChange((previous) => ({
                    ...previous,
                    notifications: { ...previous.notifications, sound },
                  }))
                }
                onDesktopNotificationChange={async (desktop) => {
                  if (desktop) {
                    if (!("Notification" in globalThis)) {
                      toast.error("Desktop notifications are not supported in this browser.");
                      return false;
                    }
                    const permission = await Notification.requestPermission();
                    if (permission !== "granted") {
                      toast.error("Desktop notifications were not enabled.", {
                        description: "Allow notifications in your browser settings and try again.",
                      });
                      return false;
                    }
                  }
                  field.handleChange((previous) => ({
                    ...previous,
                    notifications: { ...previous.notifications, desktop },
                  }));
                  return true;
                }}
                onAutoWrapChange={(autoWrap) =>
                  field.handleChange((previous) => ({ ...previous, code: { ...previous.code, autoWrap } }))
                }
                onPerformanceEnabledChange={(performanceEnabled) =>
                  field.handleChange((previous) => ({ ...previous, performanceEnabled }))
                }
                onShowFullCodeChange={(showFullCode) =>
                  field.handleChange((previous) => ({
                    ...previous,
                    code: { ...previous.code, showFullCode },
                  }))
                }
              />
            )}
          </form.Field>
          <div className="max-w-3xl">
            <BackgroundCard
              key={data.backgroundImage}
              disabled={background.isPending}
              existingBackgroundId={data.backgroundImage ?? null}
              onFileChange={(file) => background.mutate(file)}
              onRemoveExistingBackground={() => background.mutateAsync(null)}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
