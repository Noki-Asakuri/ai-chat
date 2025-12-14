import { ImagePlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export type BackgroundCardProps = {
  disabled: boolean;
  existingBackgroundId: string | null;
  onRemoveExistingBackground: () => Promise<void>;
};

export function BackgroundCard(props: BackgroundCardProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [pendingRemove, startRemoveTransition] = useTransition();

  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!backgroundImage) {
      setBackgroundPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(backgroundImage);
    setBackgroundPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [backgroundImage]);

  const existingBackgroundUrl = props.existingBackgroundId
    ? `https://ik.imagekit.io/gmethsnvl/ai-chat/${props.existingBackgroundId}`
    : null;

  const backgroundPreviewSrc = backgroundPreviewUrl ?? existingBackgroundUrl;

  const disabled = props.disabled || pendingRemove;

  function onRemove() {
    startRemoveTransition(async () => {
      setBackgroundImage(null);

      toast.promise(props.onRemoveExistingBackground(), {
        loading: "Removing background...",
        success: "Background removed",
        error: "Failed to remove background",
      });
    });
  }

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Background</CardTitle>
        <CardDescription>Optional background image used in the chat layout.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="background-image" className="text-sm leading-none font-medium">
              Background image
            </Label>

            <p className="text-sm text-muted-foreground">
              Upload an image to use as your chat background.
            </p>

            <p className="text-xs text-muted-foreground">
              {backgroundImage
                ? `Selected: ${backgroundImage.name}`
                : props.existingBackgroundId
                  ? "Current background is set."
                  : "No background set."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              disabled={disabled}
              type="button"
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlusIcon />
              Upload
            </Button>

            {props.existingBackgroundId && (
              <Button disabled={disabled} type="button" variant="destructive" onClick={onRemove}>
                <TrashIcon />
                Remove
              </Button>
            )}
          </div>
        </div>

        {backgroundPreviewSrc ? (
          <div className="overflow-hidden rounded-md border bg-muted">
            <img
              src={backgroundPreviewSrc}
              alt="Background preview"
              className="aspect-video w-full object-cover"
            />
          </div>
        ) : (
          <div className="text-muted-foreground flex aspect-video items-center justify-center rounded-md border bg-muted text-sm">
            No background selected.
          </div>
        )}

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

            setBackgroundImage(selected);
          }}
        />
      </CardContent>
    </Card>
  );
}