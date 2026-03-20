import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQuery } from "@tanstack/react-query";
import { useLoaderData, useRouter } from "@tanstack/react-router";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState, useTransition, type SubmitEvent } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { buildImageAssetUrl, getImageAssetPathFromUrl } from "@/lib/assets/urls";
import { updateAccountProfile } from "@/lib/authkit/accountServerFunctions";
import { getUserAvatarUrl, getUserInitials } from "@/lib/authkit/user";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { censorEmail } from "@/lib/email";
import { useStorage } from "@/lib/hooks/use-storage";

function getFormFile(key: string, formData: FormData): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

export function AccountProfileCard() {
  const router = useRouter();
  const { user } = useLoaderData({ from: "/settings" });
  const { data: currentUser } = useQuery(convexSessionQuery(api.functions.users.currentUser));

  const { uploadAvatarFile, deleteFile } = useStorage();
  const updateCurrentUserImage = useMutation(api.functions.users.updateCurrentUserImage);

  const [pending, startTransition] = useTransition();

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const userEmail = user.email ?? "";
  const [isEditingEmail, setIsEditingEmail] = useState<boolean>(false);
  const [emailDraft, setEmailDraft] = useState<string>("");

  const existingAvatarKey = currentUser?.imageUrl
    ? getImageAssetPathFromUrl(currentUser.imageUrl)
    : null;

  const avatarUrl = avatarPreviewUrl ?? currentUser?.imageUrl ?? getUserAvatarUrl(user);
  const initials = getUserInitials(user);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const firstNameRaw = formData.get("first-name");
    const lastNameRaw = formData.get("last-name");

    const avatarFile = getFormFile("avatar-file", formData);

    const firstName = typeof firstNameRaw === "string" ? firstNameRaw : "";
    const lastName = typeof lastNameRaw === "string" ? lastNameRaw : "";

    const emailCandidate = emailDraft.trim();
    const email = emailCandidate.length > 0 ? emailCandidate : userEmail;

    startTransition(async () => {
      const promise = (async () => {
        let avatarKey: string | undefined;

        if (avatarFile && avatarFile.size > 0) {
          avatarKey = await uploadAvatarFile({ file: avatarFile });
        }

        await updateAccountProfile({
          data: { firstName, lastName, email },
        });

        if (avatarKey) {
          await updateCurrentUserImage({ imageUrl: buildImageAssetUrl(avatarKey) });
        }

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
      setIsEditingEmail(false);
      setEmailDraft("");
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
            <div className="flex w-full flex-col items-center gap-3 md:w-48 md:items-start">
              <div className="group relative w-full">
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-md disabled:cursor-not-allowed"
                  aria-label="Change profile image"
                  title="Click to change profile image"
                  disabled={pending}
                  onClick={() => avatarFileInputRef.current?.click()}
                >
                  <Avatar className="aspect-square size-full overflow-hidden rounded-md">
                    <AvatarImage src={avatarUrl} alt="Profile image" className="object-cover" />
                    <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
                  </Avatar>
                </button>

                <div className="pointer-events-none absolute inset-0 z-10 rounded-md bg-black/0 transition-colors group-focus-within:bg-black/25 group-hover:bg-black/25" />

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
                  type={isEditingEmail ? "email" : "text"}
                  autoComplete="off"
                  className="bg-input/30"
                  disabled={pending}
                  value={
                    isEditingEmail
                      ? emailDraft
                      : censorEmail(emailDraft.trim().length > 0 ? emailDraft : userEmail)
                  }
                  placeholder={isEditingEmail ? "Enter a new email" : undefined}
                  onFocus={() => {
                    if (pending) return;
                    setIsEditingEmail(true);
                  }}
                  onBlur={() => {
                    setIsEditingEmail(false);
                  }}
                  onChange={(event) => {
                    setEmailDraft(event.currentTarget.value);
                  }}
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
