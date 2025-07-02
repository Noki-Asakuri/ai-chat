import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { ImagePlusIcon, TrashIcon } from "lucide-react";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useStorage } from "@/lib/hooks/use-storage";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Customize AI</h2>
        <p className="text-muted-foreground">
          Customize the assistant's personality to your liking.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>What should AI call you?</Label>
          <Input disabled className="bg-input/30" />
        </div>

        <div className="space-y-2">
          <Label>What do you do?</Label>
          <Input disabled className="bg-input/30" />
        </div>

        <div className="space-y-2">
          <Label>What traits should AI have?</Label>
          <Input disabled className="bg-input/30" />
        </div>

        <div className="space-y-2">
          <Label>System instruction (Global)</Label>
          <Textarea disabled className="bg-input/30 min-h-[200px]" />
        </div>

        <Button disabled>Save Preferences</Button>
      </div>
    </div>
  );
}

function getFormValue<T extends File | string>(key: string, formData: FormData): T {
  const value = formData.get(key) ?? "";

  if (value instanceof File) return value as T;
  return value as T;
}

export function CustomizePage() {
  const { data } = useQuery(convexQuery(api.users.currentUser, {}));
  const update = useMutation(api.users.updateUserCustomization);

  const { uploadFile, deleteFile } = useStorage();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);

  function handleRemoveBackground() {
    startTransition(async function () {
      if (!data?.customization?.backgroundId) return;
      await deleteFile(data.customization.backgroundId);
      setBackgroundImage(null);

      toast.promise(update({ data: { backgroundId: null } }), {
        loading: "Removing background...",
        success: "Background removed",
        error: "Failed to remove background",
      });
    });
  }

  function updateUserCustomization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = getFormValue<string>("name", formData);
    const occupation = getFormValue<string>("occupation", formData);
    const traits = getFormValue<string>("traits", formData);
    const systemInstruction = getFormValue<string>("system-instruction", formData);
    const backgroundImage = getFormValue<File>("background-image", formData);

    startTransition(async function () {
      const updates = {
        name,
        occupation,
        traits: traits?.split(",").map((t) => t.trim()),
        systemInstruction,
        backgroundId: undefined as string | undefined,
      };

      if (backgroundImage instanceof File && backgroundImage.size > 0) {
        if (data?.customization?.backgroundId) {
          await deleteFile(data.customization.backgroundId);
        }

        updates.backgroundId = await uploadFile({ file: backgroundImage });
      }

      toast.promise(update({ data: updates }), {
        loading: "Saving preferences...",
        success: "Preferences saved",
        error: "Failed to save preferences",
      });
    });
  }

  if (!data) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Customize AI</h2>
        <p className="text-muted-foreground">
          Customize the assistant's personality to your liking.
        </p>
      </div>

      <form className="space-y-4" onSubmit={updateUserCustomization}>
        <div className="space-y-2">
          <Label htmlFor="name">What should AI call you?</Label>
          <ControlledInput
            id="name"
            name="name"
            autoComplete="off"
            placeholder="Enter your name"
            className="bg-input/30"
            disabled={pending}
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
            disabled={pending}
            defaultValue={data?.customization?.occupation ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="traits">What traits should AI have?</Label>
          <ControlledInput
            id="traits"
            name="traits"
            autoComplete="off"
            placeholder="Type a trait and press Enter or Tab..."
            className="bg-input/30"
            disabled={pending}
            defaultValue={data?.customization?.traits?.join(", ") ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="system-instruction">System instruction (Global)</Label>
          <ControlledTextarea
            autoComplete="off"
            id="system-instruction"
            name="system-instruction"
            className="min-h-[200px]"
            disabled={pending}
            defaultValue={data?.customization?.systemInstruction ?? "You are a helpful assistant."}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="background-image">Background Image</Label>

          <div className="flex items-start gap-x-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-12"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlusIcon className="size-5" />
            </Button>

            {data?.customization?.backgroundId && (
              <Button
                size="icon"
                type="button"
                className="size-12"
                variant="destructive"
                onClick={handleRemoveBackground}
              >
                <TrashIcon className="size-5" />
              </Button>
            )}

            <ImagePreviewDialog
              className="aspect-video h-40"
              file={backgroundImage}
              image={{
                alt: "User Background Image",
                name: "User Background Image",
                src: data?.customization?.backgroundId
                  ? `https://ik.imagekit.io/gmethsnvl/ai-chat/${data.customization.backgroundId}`
                  : undefined,
              }}
            >
              {(objectUrl) => (
                <img
                  src={
                    objectUrl ??
                    `https://ik.imagekit.io/gmethsnvl/ai-chat/${data.customization!.backgroundId}`
                  }
                  alt="User Background Image"
                  className="h-full w-full object-cover"
                  hidden={!data?.customization?.backgroundId && !backgroundImage}
                />
              )}
            </ImagePreviewDialog>
          </div>

          <input
            type="file"
            name="background-image"
            id="background-image"
            ref={imageInputRef}
            className="hidden"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;

              setBackgroundImage(file);
            }}
          />
        </div>

        <Button type="submit" disabled={pending}>
          Save Preferences
        </Button>
      </form>
    </div>
  );
}

function ControlledInput({ defaultValue, ...props }: React.ComponentPropsWithoutRef<typeof Input>) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return <Input type="text" value={value} onValueChange={(value) => setValue(value)} {...props} />;
}

function ControlledTextarea({
  defaultValue,
  ...props
}: React.ComponentPropsWithoutRef<typeof Textarea>) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return <Textarea value={value} onChange={(event) => setValue(event.target.value)} {...props} />;
}
