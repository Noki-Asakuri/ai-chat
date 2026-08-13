import { ImageIcon, ImagePlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { buildImageAssetUrl } from "@/lib/assets/urls";

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

  useEffect(() => {
    if (!props.existingBackgroundId) return;
    setBackgroundImage(null);
  }, [props.existingBackgroundId]);

  const existingBackgroundUrl = props.existingBackgroundId
    ? buildImageAssetUrl(props.existingBackgroundId)
    : null;

  const backgroundPreviewSrc = backgroundPreviewUrl ?? existingBackgroundUrl;

  const disabled = props.disabled || pendingRemove;

  function onRemove() {
    startRemoveTransition(async () => {
      setBackgroundImage(null);

      void toast.promise(props.onRemoveExistingBackground(), {
        loading: "Removing background...",
        success: "Background removed",
        error: "Failed to remove background",
      });
    });
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle>Chat background</CardTitle>
        <CardDescription>Add a personal image behind your conversations.</CardDescription>
      </CardHeader>

      <CardContent className="p-3">
        {backgroundPreviewSrc ? (
          <div className="relative overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10">
            <img
              src={backgroundPreviewSrc}
              alt="Background preview"
              className="aspect-[16/10] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-background/80 px-3 py-2 backdrop-blur-sm">
              <p className="truncate text-xs text-foreground">
                {backgroundImage ? backgroundImage.name : "Current background"}
              </p>
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

      <CardFooter className="justify-end gap-2 bg-muted/30">
        {props.existingBackgroundId && (
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
      </CardFooter>
    </Card>
  );
}
