import { useLoaderData, useRouter } from "@tanstack/react-router";
import { TrashIcon, UploadCloudIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateAccountProfile } from "@/lib/authkit/accountServerFunctions";
import { getUserAvatarUrl, getUserInitials } from "@/lib/authkit/user";
import { useStorage } from "@/lib/hooks/use-storage";

function getFormFile(key: string, formData: FormData): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function normalizeOptionalMetadataString(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
}

export function AccountProfileCard() {
  const router = useRouter();
  const { user } = useLoaderData({ from: "/settings" });

  const { uploadAvatarFile, deleteFile } = useStorage();

  const [pending, startTransition] = useTransition();

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const existingAvatarKey = normalizeOptionalMetadataString(user.metadata.avatarKey);

  const avatarUrl = avatarPreviewUrl ?? getUserAvatarUrl(user);
  const initials = getUserInitials(user);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const firstNameRaw = formData.get("first-name");
    const lastNameRaw = formData.get("last-name");
    const emailRaw = formData.get("email");

    const avatarFile = getFormFile("avatar-file", formData);

    const firstName = typeof firstNameRaw === "string" ? firstNameRaw : "";
    const lastName = typeof lastNameRaw === "string" ? lastNameRaw : "";
    const email = typeof emailRaw === "string" ? emailRaw : "";

    startTransition(async () => {
      const promise = (async () => {
        let avatarKey: string | undefined;

        if (avatarFile && avatarFile.size > 0) {
          avatarKey = await uploadAvatarFile({ file: avatarFile });
        }

        await updateAccountProfile({
          data: { firstName, lastName, email, avatarKey },
        });

        if (avatarKey && existingAvatarKey && existingAvatarKey !== avatarKey) {
          await deleteFile(existingAvatarKey);
        }
      })();

      toast.promise(promise, {
        loading: "Saving account...",
        success: "Account updated",
        error: (err) => (err instanceof Error ? err.message : "Failed to update account"),
      });

      await promise;
      setAvatarPreviewUrl(null);
      await router.invalidate();
    });
  }

  function removeUploadedAvatar() {
    if (!existingAvatarKey) return;

    startTransition(async () => {
      const promise = (async () => {
        await updateAccountProfile({
          data: {
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            email: user.email ?? "",
            avatarKey: null,
          },
        });

        await deleteFile(existingAvatarKey);
      })();

      toast.promise(promise, {
        loading: "Removing photo...",
        success: "Profile photo removed",
        error: (err) => (err instanceof Error ? err.message : "Failed to remove photo"),
      });

      await promise;
      await router.invalidate();
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name, email, and profile image.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
            <div className="flex w-full flex-col items-center gap-3 md:w-64 md:items-start">
              <div className="group relative w-full">
                <Avatar className="aspect-square size-full overflow-hidden rounded-md">
                  <AvatarImage src={avatarUrl} alt="Profile image" className="object-cover" />
                  <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
                </Avatar>

                <div className="pointer-events-none absolute inset-0 z-10 rounded-md bg-black/0 transition-colors group-focus-within:bg-black/25 group-hover:bg-black/25" />

                <div className="pointer-events-none absolute top-2 right-2 z-20 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="pointer-events-auto size-8"
                    aria-label="Upload profile image"
                    disabled={pending}
                    onClick={() => avatarFileInputRef.current?.click()}
                  >
                    <UploadCloudIcon className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="pointer-events-auto size-8 border-destructive/60"
                    aria-label="Remove profile image"
                    disabled={pending || !existingAvatarKey}
                    onClick={removeUploadedAvatar}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>

                <Input
                  ref={avatarFileInputRef}
                  id="avatar-file"
                  name="avatar-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={pending}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) {
                      setAvatarPreviewUrl(null);
                      return;
                    }

                    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                    setAvatarPreviewUrl(URL.createObjectURL(file));
                  }}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Hover your photo to upload a new one or remove it (PNG, JPG, WebP).
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="first-name">First name</Label>
                <Input
                  id="first-name"
                  name="first-name"
                  autoComplete="given-name"
                  className="bg-input/30"
                  disabled={pending}
                  defaultValue={user.firstName ?? ""}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="last-name">Last name</Label>
                <Input
                  id="last-name"
                  name="last-name"
                  autoComplete="family-name"
                  className="bg-input/30"
                  disabled={pending}
                  defaultValue={user.lastName ?? ""}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="bg-input/30"
                  disabled={pending}
                  defaultValue={user.email ?? ""}
                />
              </div>

              <div className="col-span-2 flex w-full items-end justify-end">
                <Button type="submit" disabled={pending}>
                  Save account
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
