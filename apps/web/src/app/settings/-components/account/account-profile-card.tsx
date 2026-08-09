import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQuery } from "@tanstack/react-query";
import { useLoaderData, useRouter } from "@tanstack/react-router";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState, useTransition, type SubmitEvent } from "react";
import { toast } from "@/components/ui/toast";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { buildImageAssetUrl, getImageAssetPathFromUrl } from "@/lib/assets/urls";
import {
  confirmAccountEmailChange,
  startAccountEmailChange,
  updateAccountProfile,
} from "@/lib/authkit/accountServerFunctions";
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
  const [emailChangeCode, setEmailChangeCode] = useState<string>("");
  const [emailChangeCodeSent, setEmailChangeCodeSent] = useState<boolean>(false);

  const existingAvatarKey = currentUser?.imageUrl ? getImageAssetPathFromUrl(currentUser.imageUrl) : null;

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

    startTransition(async () => {
      const promise = (async () => {
        let avatarKey: string | undefined;

        if (avatarFile && avatarFile.size > 0) {
          avatarKey = await uploadAvatarFile({ file: avatarFile });
        }

        await updateAccountProfile({
          data: { firstName, lastName },
        });

        if (avatarKey) {
          await updateCurrentUserImage({ imageUrl: buildImageAssetUrl(avatarKey) });
        }

        if (avatarKey && existingAvatarKey && existingAvatarKey !== avatarKey) {
          await deleteFile(existingAvatarKey);
        }
      })();

      void toast.promise(promise, {
        loading: "Saving account...",
        success: "Account updated",
        error: (err) => (err instanceof Error ? err.message : "Failed to update account"),
      });

      await promise;
      setAvatarPreviewUrl(null);
      await router.invalidate();
    });
  }

  function reauthenticate() {
    window.location.href = "/auth/login?rt=%2Fsettings%2Faccount&maxAge=300";
  }

  function startEmailChange() {
    const email = emailDraft.trim();

    startTransition(async () => {
      try {
        const result = await startAccountEmailChange({ data: { email } });
        if (result.status === "reauth_required") {
          reauthenticate();
          return;
        }

        setEmailChangeCodeSent(true);
        toast.success("Verification code sent");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send verification code");
      }
    });
  }

  function confirmEmailChange() {
    startTransition(async () => {
      try {
        const result = await confirmAccountEmailChange({ data: { code: emailChangeCode } });
        if (result.status === "reauth_required") {
          reauthenticate();
          return;
        }

        setEmailChangeCodeSent(false);
        setEmailChangeCode("");
        setEmailDraft("");
        setIsEditingEmail(false);
        toast.success("Email changed");
        await router.invalidate();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to change email");
      }
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
                <div className="flex gap-2">
                  <Input
                    id="email"
                    name="email"
                    type={isEditingEmail ? "email" : "text"}
                    autoComplete="email"
                    className="bg-input/30"
                    disabled={pending || emailChangeCodeSent}
                    value={
                      isEditingEmail
                        ? emailDraft
                        : censorEmail(emailDraft.trim().length > 0 ? emailDraft : userEmail)
                    }
                    placeholder={isEditingEmail ? "Enter a new email" : undefined}
                    onFocus={() => {
                      if (pending || emailChangeCodeSent) return;
                      setIsEditingEmail(true);
                    }}
                    onBlur={() => {
                      setIsEditingEmail(false);
                    }}
                    onChange={(event) => {
                      setEmailDraft(event.currentTarget.value);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || emailChangeCodeSent || emailDraft.trim().length === 0}
                    onClick={startEmailChange}
                  >
                    Send code
                  </Button>
                </div>
              </div>

              {emailChangeCodeSent ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email-change-code">Verification code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="email-change-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="bg-input/30"
                      disabled={pending}
                      value={emailChangeCode}
                      onChange={(event) => setEmailChangeCode(event.currentTarget.value)}
                    />
                    <Button
                      type="button"
                      disabled={pending || emailChangeCode.trim().length === 0}
                      onClick={confirmEmailChange}
                    >
                      Confirm email
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Changing your email requires recent authentication and a code sent to the new address.
                </p>
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
