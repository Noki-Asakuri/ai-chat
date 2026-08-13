import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { useDebounce } from "@uidotdev/usehooks";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useMutation } from "convex/react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

import type { SendPreference } from "@/lib/chat/send-preference";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { useStorage } from "@/lib/hooks/use-storage";
import { tryCatch } from "@/lib/utils";
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

import { BackgroundCard } from "../-components/customization/background-card";
import { BehaviorOptionsCard } from "../-components/customization/behavior-options-card";
import { FontsCard } from "../-components/customization/fonts-card";
import { AutosaveStatus } from "../-components/autosave-status";

import { LoadingAppearanceSkeleton } from "./-pending";

export const Route = createFileRoute("/settings/appearance")({
  component: RouteComponent,
  pendingComponent: LoadingAppearanceSkeleton,
  head: () => ({ meta: [{ title: "Appearance - AI Chat" }] }),
});

function getFormFile(key: string, formData: FormData): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function RouteComponent() {
  const { user } = useAuth({ ensureSignedIn: true });
  const { data, isPending } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );
  const updateUserPreferences = useMutation(api.functions.users.updateUserPreferences);
  const { uploadFile, deleteFile } = useStorage();

  const [sendPreference, setSendPreference] = useState<SendPreference>(data?.sendPreference ?? "enter");
  const [notificationSound, setNotificationSound] = useState(data?.notifications?.sound ?? true);
  const [desktopNotification, setDesktopNotification] = useState(data?.notifications?.desktop ?? false);
  const [autoWrap, setAutoWrap] = useState(data?.code?.autoWrap ?? false);
  const [performanceEnabled, setPerformanceEnabled] = useState(data?.performanceEnabled ?? false);
  const [showFullCode, setShowFullCode] = useState(data?.code?.showFullCode ?? false);
  const [uiFont, setUiFont] = useState(data?.fonts?.ui ?? DEFAULT_UI_FONT);
  const [uiFontSize, setUiFontSize] = useState(data?.fonts?.uiSize ?? DEFAULT_UI_FONT_SIZE);
  const [promptFont, setPromptFont] = useState(data?.fonts?.prompt ?? DEFAULT_UI_FONT);
  const [promptFontSize, setPromptFontSize] = useState(data?.fonts?.promptSize ?? DEFAULT_PROMPT_FONT_SIZE);
  const [codeFont, setCodeFont] = useState(data?.fonts?.code ?? DEFAULT_CODE_FONT);
  const [codeFontSize, setCodeFontSize] = useState(data?.fonts?.codeSize ?? DEFAULT_CODE_FONT_SIZE);
  const [backgroundImageId, setBackgroundImageId] = useState<string | null>(data?.backgroundImage ?? null);
  const [saveRequestCount, setSaveRequestCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const debouncedSaveRequestCount = useDebounce(saveRequestCount, 700);

  const formRef = useRef<HTMLFormElement>(null);
  const isSavingRef = useRef(false);
  const hasPendingSaveRef = useRef(false);
  const backgroundIdRef = useRef<string | null>(data?.backgroundImage ?? null);
  const runAutoSaveRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => setSendPreference(data?.sendPreference ?? "enter"), [data?.sendPreference]);
  useEffect(() => setNotificationSound(data?.notifications?.sound ?? true), [data?.notifications?.sound]);
  useEffect(
    () => setDesktopNotification(data?.notifications?.desktop ?? false),
    [data?.notifications?.desktop],
  );
  useEffect(() => setAutoWrap(data?.code?.autoWrap ?? false), [data?.code?.autoWrap]);
  useEffect(() => setPerformanceEnabled(data?.performanceEnabled ?? false), [data?.performanceEnabled]);
  useEffect(() => setShowFullCode(data?.code?.showFullCode ?? false), [data?.code?.showFullCode]);
  useEffect(() => setUiFont(data?.fonts?.ui ?? DEFAULT_UI_FONT), [data?.fonts?.ui]);
  useEffect(() => setUiFontSize(data?.fonts?.uiSize ?? DEFAULT_UI_FONT_SIZE), [data?.fonts?.uiSize]);
  useEffect(() => setPromptFont(data?.fonts?.prompt ?? DEFAULT_UI_FONT), [data?.fonts?.prompt]);
  useEffect(
    () => setPromptFontSize(data?.fonts?.promptSize ?? DEFAULT_PROMPT_FONT_SIZE),
    [data?.fonts?.promptSize],
  );
  useEffect(() => setCodeFont(data?.fonts?.code ?? DEFAULT_CODE_FONT), [data?.fonts?.code]);
  useEffect(() => setCodeFontSize(data?.fonts?.codeSize ?? DEFAULT_CODE_FONT_SIZE), [data?.fonts?.codeSize]);
  useEffect(() => setBackgroundImageId(data?.backgroundImage ?? null), [data?.backgroundImage]);

  useEffect(() => {
    if (!user) return;

    const fonts = {
      ui: uiFont,
      uiSize: uiFontSize,
      prompt: promptFont,
      promptSize: promptFontSize,
      code: codeFont,
      codeSize: codeFontSize,
    };

    cacheTypography(user.id, fonts);
    applyTypography(document.documentElement, fonts);
  }, [codeFont, codeFontSize, promptFont, promptFontSize, uiFont, uiFontSize, user]);

  useEffect(() => {
    backgroundIdRef.current = backgroundImageId;
  }, [backgroundImageId]);

  const requestAutoSave = useCallback(() => {
    setSaveRequestCount((count) => count + 1);
  }, []);

  const updateDesktopNotification = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (!enabled) {
      setDesktopNotification(false);
      return true;
    }

    if (typeof Notification === "undefined") {
      toast.error("Desktop notifications are not supported in this browser.");
      setDesktopNotification(false);
      return false;
    }

    if (Notification.permission === "granted") {
      setDesktopNotification(true);
      return true;
    }

    if (Notification.permission === "denied") {
      toast.error("Desktop notifications are blocked", {
        description: "Allow notifications in your browser settings and try again.",
      });
      setDesktopNotification(false);
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setDesktopNotification(true);
      return true;
    }

    toast.error("Desktop notifications were not enabled.");
    setDesktopNotification(false);
    return false;
  }, []);

  const savePreferences = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;

    const previousBackgroundId = backgroundIdRef.current;
    const nextBackgroundFile = getFormFile("background-image", new FormData(form));

    let uploadedBackgroundId: string | null = null;
    if (nextBackgroundFile && nextBackgroundFile.size > 0) {
      uploadedBackgroundId = await uploadFile({ file: nextBackgroundFile });
    }

    const updates: Partial<Doc<"users">["preferences"]> = {
      performanceEnabled,
      sendPreference,
      notifications: { sound: notificationSound, desktop: desktopNotification },
      fonts: {
        ui: uiFont,
        uiSize: uiFontSize,
        prompt: promptFont,
        promptSize: promptFontSize,
        code: codeFont,
        codeSize: codeFontSize,
      },
      code: { showFullCode, autoWrap },
      backgroundImage: uploadedBackgroundId ?? previousBackgroundId,
    };

    const [, updateError] = await tryCatch(updateUserPreferences({ data: updates }));
    if (updateError) {
      if (uploadedBackgroundId) await deleteFile(uploadedBackgroundId);
      throw updateError;
    }

    if (!uploadedBackgroundId) return;

    backgroundIdRef.current = uploadedBackgroundId;
    setBackgroundImageId(uploadedBackgroundId);

    if (previousBackgroundId && previousBackgroundId !== uploadedBackgroundId) {
      await deleteFile(previousBackgroundId);
    }

    const backgroundInput = form.elements.namedItem("background-image");
    if (backgroundInput instanceof HTMLInputElement) backgroundInput.value = "";
  }, [
    autoWrap,
    codeFont,
    codeFontSize,
    deleteFile,
    desktopNotification,
    notificationSound,
    performanceEnabled,
    promptFont,
    promptFontSize,
    sendPreference,
    showFullCode,
    uiFont,
    uiFontSize,
    updateUserPreferences,
    uploadFile,
  ]);

  const runAutoSave = useCallback(async () => {
    if (isSavingRef.current) {
      hasPendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    while (true) {
      hasPendingSaveRef.current = false;
      const [, error] = await tryCatch(savePreferences());

      if (error) {
        toast.error("Failed to save appearance", {
          id: "appearance-autosave-error",
          description: error.message,
        });
      }

      if (!hasPendingSaveRef.current) break;
    }

    isSavingRef.current = false;
    setIsSaving(false);
  }, [savePreferences]);

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

    const backgroundInput = formRef.current?.elements.namedItem("background-image");
    if (backgroundInput instanceof HTMLInputElement) backgroundInput.value = "";
  }

  const customStyle: CSSProperties = getTypographyStyle({
    ui: uiFont,
    uiSize: uiFontSize,
    prompt: promptFont,
    promptSize: promptFontSize,
    code: codeFont,
    codeSize: codeFontSize,
  });

  return (
    <div className="font-sans" style={customStyle}>
      <form ref={formRef} onSubmit={(event) => event.preventDefault()} onChangeCapture={requestAutoSave}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">Changes save automatically.</p>
            <AutosaveStatus isSaving={isSaving} />
          </div>

          <FontsCard
            disabled={isPending}
            uiFont={uiFont}
            uiFontSize={uiFontSize}
            promptFont={promptFont}
            promptFontSize={promptFontSize}
            codeFont={codeFont}
            codeFontSize={codeFontSize}
            onUiFontChange={(font) => {
              setUiFont(font);
              requestAutoSave();
            }}
            onUiFontSizeChange={(size) => {
              setUiFontSize(size);
              requestAutoSave();
            }}
            onPromptFontChange={(font) => {
              setPromptFont(font);
              requestAutoSave();
            }}
            onPromptFontSizeChange={(size) => {
              setPromptFontSize(size);
              requestAutoSave();
            }}
            onCodeFontChange={(font) => {
              setCodeFont(font);
              requestAutoSave();
            }}
            onCodeFontSizeChange={(size) => {
              setCodeFontSize(size);
              requestAutoSave();
            }}
          />

          <BehaviorOptionsCard
            disabled={isPending}
            autoWrap={autoWrap}
            performanceEnabled={performanceEnabled}
            showFullCode={showFullCode}
            sendPreference={sendPreference}
            notificationSound={notificationSound}
            desktopNotification={desktopNotification}
            onSendPreferenceChange={setSendPreference}
            onNotificationSoundChange={setNotificationSound}
            onDesktopNotificationChange={updateDesktopNotification}
            onAutoWrapChange={setAutoWrap}
            onPerformanceEnabledChange={setPerformanceEnabled}
            onShowFullCodeChange={setShowFullCode}
            onBehaviorChange={requestAutoSave}
          />

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <BackgroundCard
              disabled={isPending || isSaving}
              existingBackgroundId={backgroundImageId}
              onRemoveExistingBackground={removeExistingBackground}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
