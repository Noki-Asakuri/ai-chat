import type { Id } from "@/convex/_generated/dataModel";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/utils";

type ProfileEditSeed = {
  id: Id<"profiles">;
  name: string;
  systemPrompt: string;
};

export function ProfileDialog({
  open,
  onOpenChange,
  editing,
  name,
  onNameChange,
  systemPrompt,
  onSystemPromptChange,
  file,
  onFileChange,
  filePreviewUrl,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ProfileEditSeed | null;

  name: string;
  onNameChange: (value: string) => void;

  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;

  file: File | null;
  onFileChange: (file: File | null) => void;
  filePreviewUrl: string | null;

  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          "data-[size=default]:max-w-[min(92vw,42rem)]",
          "data-[size=default]:sm:max-w-4xl",
          "data-[size=default]:lg:max-w-5xl",
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{editing ? "Edit Profile" : "Create Profile"}</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-[12rem_1fr]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border bg-muted/30">
              {filePreviewUrl ? (
                <div className="relative aspect-square w-full">
                  <img
                    src={filePreviewUrl}
                    alt="Selected profile image preview"
                    className="absolute inset-0 size-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/25 to-transparent p-2">
                    <div className="text-xs font-medium text-white">Image preview</div>
                    <div className="text-xs text-white/80">
                      <span className="block truncate" title={file?.name ?? ""}>
                        {file?.name}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 p-3 text-center">
                  <div className="text-xs font-medium">Image</div>
                  <div className="text-xs text-muted-foreground">Optional</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-image" className="text-sm leading-none font-medium">
                Profile image
              </Label>
              <Input
                id="profile-image"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  onFileChange(next);
                }}
              />
              <p className="text-xs text-muted-foreground">PNG, JPG, or WebP.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name" className="text-sm leading-none font-medium">
                Name
              </Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. Helpful Researcher"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-system-prompt" className="text-sm leading-none font-medium">
                System prompt
              </Label>
              <Textarea
                id="profile-system-prompt"
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                rows={10}
                className="min-h-48 rounded-md"
                placeholder="Describe how this AI should behave…"
              />
              <p className="text-xs text-muted-foreground">
                This is the main instruction that shapes the persona.
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting || !name.trim() || !systemPrompt.trim()}
            onClick={onSubmit}
          >
            {editing ? "Save" : "Create"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
