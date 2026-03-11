import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { Dialog } from "@base-ui/react/dialog";
import { useSessionMutation } from "convex-helpers/react/sessions";
import {
  CopyCheckIcon,
  CopyIcon,
  GlobeIcon,
  Loader2Icon,
  LockIcon,
  RadioIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { buttonVariants } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Textarea } from "../ui/textarea";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { cn } from "@/lib/utils";

type ThreadShareDialogProps = {
  threadId: Id<"threads">;
  threadTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ShareVisibility = "public" | "private";
type ShareMode = "snapshot" | "live";

export function ThreadShareDialog({
  threadId,
  threadTitle,
  open,
  onOpenChange,
}: ThreadShareDialogProps) {
  const upsertThreadShare = useSessionMutation(api.functions.threadShares.upsertThreadShare);
  const disableThreadShare = useSessionMutation(api.functions.threadShares.disableThreadShare);
  const [isSaving, startSaving] = useTransition();
  const [isDisabling, startDisabling] = useTransition();

  const [visibility, setVisibility] = useState<ShareVisibility>("public");
  const [mode, setMode] = useState<ShareMode>("live");
  const [allowedEmailsText, setAllowedEmailsText] = useState("");
  const [localSharePath, setLocalSharePath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isFetching, isPending } = useQuery({
    ...convexSessionQuery(
      api.functions.threadShares.getThreadShareSettings,
      open ? { threadId } : "skip",
    ),
  });

  useEffect(() => {
    if (!open || !data) return;

    setVisibility(data.visibility);
    setMode(data.mode);
    setAllowedEmailsText(data.allowedEmailsText);
    setLocalSharePath(data.urlPath);
    setCopied(false);
  }, [data, open]);

  const currentPath = localSharePath ?? data?.urlPath ?? null;
  const shareUrl = useMemo(() => {
    if (!currentPath) return "";
    if (typeof window === "undefined") return currentPath;
    return new URL(currentPath, window.location.origin).toString();
  }, [currentPath]);

  const hasChanges =
    visibility !== (data?.visibility ?? "public") ||
    mode !== (data?.mode ?? "live") ||
    allowedEmailsText.trim() !== (data?.allowedEmailsText ?? "").trim();

  const canSave =
    !isPending && !isSaving && !isDisabling && data !== undefined && (!data.shareId || hasChanges);
  const hasShare = Boolean(currentPath);

  async function handleCopyShareLink() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      toast.error("Failed to copy share link", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  function handleSave() {
    startSaving(async () => {
      try {
        const next = await upsertThreadShare({
          threadId,
          visibility,
          mode,
          allowedEmailsText,
        });

        setLocalSharePath(next.urlPath);
        setAllowedEmailsText(next.allowedEmailsText);

        toast.success("Thread sharing updated");
      } catch (error) {
        toast.error("Failed to update sharing", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  function handleDisableSharing() {
    if (!hasShare) return;

    startDisabling(async () => {
      try {
        const next = await disableThreadShare({ threadId });

        setLocalSharePath(next.urlPath);
        setVisibility(next.visibility);
        setMode(next.mode);
        setAllowedEmailsText(next.allowedEmailsText);
        setCopied(false);

        toast.success("Thread sharing disabled");
      } catch (error) {
        toast.error("Failed to disable sharing", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:opacity-70" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(96vw,40rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="mb-2">
            <h2 className="text-lg font-semibold">Share thread</h2>
            <p className="text-sm text-muted-foreground">{threadTitle}</p>
          </div>

          <div className="mt-3 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Visibility</Label>
              <RadioGroup
                value={visibility}
                onValueChange={(value) => {
                  if (value === "public" || value === "private") {
                    setVisibility(value);
                  }
                }}
                className="gap-2"
              >
                <Label className="flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left">
                  <RadioGroupItem value="public" className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm leading-none font-medium">
                      <GlobeIcon className="size-4" />
                      Public link
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Anyone with the link can view this shared thread.
                    </span>
                  </span>
                </Label>

                <Label className="flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left">
                  <RadioGroupItem value="private" className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm leading-none font-medium">
                      <LockIcon className="size-4" />
                      Private link
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Requires login and email allowlist match.
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Update mode</Label>
              <RadioGroup
                value={mode}
                onValueChange={(value) => {
                  if (value === "snapshot" || value === "live") {
                    setMode(value);
                  }
                }}
                className="gap-2"
              >
                <Label className="flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left">
                  <RadioGroupItem value="snapshot" className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm leading-none font-medium">
                      <RadioIcon className="size-4" />
                      Snapshot
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Freezes at the current point of conversation.
                    </span>
                  </span>
                </Label>

                <Label className="flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left">
                  <RadioGroupItem value="live" className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm leading-none font-medium">
                      <ZapIcon className="size-4" />
                      Live
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Updates as new messages are added.
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>

            {visibility === "private" && (
              <div className="space-y-2">
                <Label htmlFor="thread-share-email-list" className="text-sm">
                  Allowed emails
                </Label>
                <Textarea
                  id="thread-share-email-list"
                  value={allowedEmailsText}
                  onChange={(event) => setAllowedEmailsText(event.target.value)}
                  placeholder="name@example.com\nteam@example.com"
                  className="min-h-24 rounded-md"
                />
                <p className="text-xs text-muted-foreground">
                  Use comma, spaces, or new lines. Your own account is always allowed.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Share link</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  placeholder={isFetching ? "Loading..." : "Save to create a share link"}
                  className="h-9 rounded-md"
                />

                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  disabled={!shareUrl}
                  className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}
                >
                  {copied ? (
                    <>
                      <CopyCheckIcon className="size-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {hasShare && (
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "destructive" }), "mr-auto")}
                  onClick={handleDisableSharing}
                  disabled={isDisabling || isSaving}
                >
                  {isDisabling ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-4" />
                  )}
                  Disable sharing
                </button>
              )}

              <Dialog.Close className={cn(buttonVariants({ variant: "ghost" }))}>
                Cancel
              </Dialog.Close>

              <button
                type="button"
                className={cn(buttonVariants({ variant: "default" }))}
                onClick={handleSave}
                disabled={!canSave}
              >
                {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
