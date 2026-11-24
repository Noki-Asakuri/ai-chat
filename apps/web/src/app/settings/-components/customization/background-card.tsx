import { ImageIcon, ImagePlusIcon, RotateCwIcon, TrashIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/settings-section";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Slider } from "@/components/ui/slider";
import { MAX_BACKDROP_BLUR, type BlurMode } from "@/lib/appearance/theme";
import { buildImageAssetUrl } from "@/lib/assets/urls";
import { cn } from "@/lib/utils";

/** The preview is about a third of a typical window, so scale the blur to match. */
const PREVIEW_BLUR_SCALE = 0.4;

const BLUR_OPTIONS = [
  {
    value: "messages",
    label: "Behind messages",
    description: "The image stays sharp. Each message sits on its own frosted panel.",
  },
  {
    value: "backdrop",
    label: "Whole background",
    description: "The image itself is blurred, like frosted glass behind the whole app.",
  },
] as const satisfies ReadonlyArray<{ value: BlurMode; label: string; description: string }>;

export type BackgroundCardProps = {
  disabled: boolean;
  failed: boolean;
  existingBackgroundId: string | null;
  onRemoveExistingBackground: () => Promise<void>;
  onFileChange: (file: File) => void;
  onRetry: () => void;
  onDiscard: () => void;
  blurMode: BlurMode;
  backdropBlur: number;
  onBlurModeChange: (mode: BlurMode) => void;
  onBackdropBlurChange: (blur: number) => void;
};

export function BackgroundCard(props: BackgroundCardProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [pendingRemove, startRemoveTransition] = useTransition();

  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);
  const backgroundPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (backgroundPreviewUrlRef.current) URL.revokeObjectURL(backgroundPreviewUrlRef.current);
    };
  }, []);

  const existingBackgroundUrl = props.existingBackgroundId
    ? buildImageAssetUrl(props.existingBackgroundId)
    : null;

  const backgroundPreviewSrc = backgroundPreviewUrl ?? existingBackgroundUrl;

  const disabled = props.disabled || pendingRemove;
  const previewBlur = props.blurMode === "backdrop" ? props.backdropBlur * PREVIEW_BLUR_SCALE : 0;
  const failedUpload = props.failed && backgroundImage !== null;

  function clearPreview() {
    if (backgroundPreviewUrlRef.current) URL.revokeObjectURL(backgroundPreviewUrlRef.current);
    backgroundPreviewUrlRef.current = null;
    setBackgroundPreviewUrl(null);
    setBackgroundImage(null);
  }

  function onDiscard() {
    clearPreview();
    props.onDiscard();
  }

  function onRemove() {
    startRemoveTransition(async () => {
      clearPreview();

      void toast.promise(props.onRemoveExistingBackground(), {
        loading: "Removing background...",
        success: "Background removed",
        error: "Failed to remove background",
      });
    });
  }

  const previewSlot = backgroundPreviewSrc ? (
    <div className="relative overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10">
      <img
        src={backgroundPreviewSrc}
        alt="Background preview"
        className="aspect-[16/10] w-full object-cover transition-[filter,transform] duration-200 motion-reduce:transition-none"
        style={{ filter: `blur(${previewBlur}px)`, transform: `scale(${1 + previewBlur / 80})` }}
      />
      <div
        aria-hidden
        className={cn(
          "surface-edge absolute top-1/2 left-1/2 w-3/5 -translate-x-1/2 -translate-y-1/2 space-y-2 rounded-md border bg-background/75 p-3",
          props.blurMode === "messages" && "backdrop-blur-md backdrop-saturate-150",
        )}
      >
        <div className="h-2 w-4/5 rounded-full bg-foreground/50" />
        <div className="h-2 w-3/5 rounded-full bg-foreground/30" />
        <div className="h-2 w-2/3 rounded-full bg-foreground/30" />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-background/80 px-3 py-2 backdrop-blur-sm">
        {failedUpload ? (
          <p role="alert" className="truncate text-xs text-destructive">
            Couldn't save {backgroundImage.name}
          </p>
        ) : (
          <p className="truncate text-xs text-foreground">
            {backgroundImage ? backgroundImage.name : "Current background"}
          </p>
        )}
      </div>
    </div>
  ) : (
    <Item variant="muted" className="aspect-[16/10] flex-col justify-center border border-dashed">
      <ItemMedia variant="icon" className="rounded-md bg-background p-3 text-muted-foreground">
        <ImageIcon />
      </ItemMedia>
      <ItemContent className="flex-none items-center text-center">
        <ItemTitle>No background image</ItemTitle>
        <ItemDescription className="max-w-64">
          Upload an image to add depth and personality to your chat workspace.
        </ItemDescription>
      </ItemContent>
    </Item>
  );

  return (
    <SettingsSection
      id="chat-background"
      title="Chat background"
      description="Add a personal image behind your conversations and choose how it's blurred."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,1fr)] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          {previewSlot}

          <input
            type="file"
            name="background-image"
            id="background-image"
            ref={imageInputRef}
            className="hidden"
            accept="image/*"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;

              if (backgroundPreviewUrlRef.current) URL.revokeObjectURL(backgroundPreviewUrlRef.current);
              const nextPreviewUrl = URL.createObjectURL(selected);
              backgroundPreviewUrlRef.current = nextPreviewUrl;
              setBackgroundPreviewUrl(nextPreviewUrl);
              setBackgroundImage(selected);
              props.onFileChange(selected);
              // Clear the input so choosing the same file again still fires a change event.
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap justify-end gap-2">
            {failedUpload && (
              <>
                <Button disabled={disabled} type="button" variant="ghost" onClick={onDiscard}>
                  Discard
                </Button>
                <Button disabled={disabled} type="button" variant="outline" onClick={props.onRetry}>
                  <RotateCwIcon data-icon="inline-start" />
                  Retry upload
                </Button>
              </>
            )}
            {!failedUpload && props.existingBackgroundId && (
              <Button disabled={disabled} type="button" variant="ghost" onClick={onRemove}>
                <TrashIcon data-icon="inline-start" />
                Remove
              </Button>
            )}
            <Button
              disabled={disabled}
              type="button"
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlusIcon data-icon="inline-start" />
              {backgroundPreviewSrc ? "Replace" : "Choose image"}
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Blur style</legend>
            {BLUR_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 rounded-md border p-3 text-sm font-medium transition-colors hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  props.blurMode === option.value && "border-primary/60 bg-primary/5 hover:bg-primary/5",
                )}
              >
                <input
                  type="radio"
                  name="background-blur-mode"
                  value={option.value}
                  checked={props.blurMode === option.value}
                  onChange={() => props.onBlurModeChange(option.value)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                {option.label}
                <span className="col-start-2 text-xs/relaxed font-normal text-pretty text-muted-foreground">
                  {option.description}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <p id="background-blur-strength" className="text-sm font-medium">
                Blur strength
              </p>
              <span className="text-sm text-muted-foreground tabular-nums">{props.backdropBlur}px</span>
            </div>
            <Slider
              min={0}
              max={MAX_BACKDROP_BLUR}
              step={2}
              disabled={props.blurMode !== "backdrop"}
              value={[props.backdropBlur]}
              getAriaLabel={() => "Background blur strength"}
              onValueChange={(value) =>
                props.onBackdropBlurChange(Array.isArray(value) ? (value[0] ?? 0) : value)
              }
            />
            <p className="text-xs/relaxed text-pretty text-muted-foreground">
              Applies to the whole-background style.
            </p>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
