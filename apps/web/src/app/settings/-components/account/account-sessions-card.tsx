import { useQuery } from "@tanstack/react-query";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronLeftIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/settings-section";
import { Skeleton } from "@/components/ui/skeleton";

import { listAccountSessions, revokeAccountSession } from "@/lib/authkit/account-server-functions";
import { cn } from "@/lib/utils";

type AccountSessionRow = {
  id: string;
  authMethod: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  status: string;
};

type RevokeDialogState = {
  open: boolean;
  sessionId: string | null;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function shortUserAgent(value: string | null): string {
  if (!value) return "Unknown device";
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

function getQueryErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Failed to load active sessions";
}

function AuthMethodBadge({ authMethod }: { authMethod: string }) {
  if (authMethod === "passkey") return <Badge>Passkey</Badge>;
  if (authMethod === "password") return <Badge>Password</Badge>;
  if (authMethod === "magic_code") return <Badge>Magic code</Badge>;
  if (authMethod === "sso") return <Badge>SSO</Badge>;
  return (
    <Badge variant="secondary" className="capitalize">
      {authMethod}
    </Badge>
  );
}

function RevokeSessionDialog({
  open,
  onOpenChange,
  sessionId,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-3 p-4">
        <AlertDialogHeader className="gap-1">
          <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
          <AlertDialogDescription>
            This will sign the device out. You cannot revoke the current session.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="text-xs text-muted-foreground">
          Session: <span className="font-mono">{sessionId ?? "-"}</span>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending || !sessionId}>
            {pending ? "Revoking..." : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AccountSessionsCard() {
  const router = useRouter();
  const { auth } = useLoaderData({ from: "__root__" });

  const currentSessionId = auth.user ? auth.sessionId : undefined;

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const { data, error, isError, isPending, refetch } = useQuery({
    queryKey: ["account-sessions"],
    queryFn: async () => await listAccountSessions(),
    enabled: sessionsOpen,
  });

  const [revokeState, setRevokeState] = useState<RevokeDialogState>({
    open: false,
    sessionId: null,
  });
  const [pending, startTransition] = useTransition();

  const rows: Array<AccountSessionRow> = [];
  for (const session of data?.sessions ?? []) {
    rows.push({
      id: session.id,
      authMethod: session.authMethod,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      status: session.status,
    });
  }

  function openRevokeDialog(sessionId: string) {
    setRevokeState({ open: true, sessionId });
  }

  function closeRevokeDialog() {
    setRevokeState({ open: false, sessionId: null });
  }

  function revokeSelected() {
    const sessionId = revokeState.sessionId;
    if (!sessionId) return;

    startTransition(async () => {
      try {
        const result = await revokeAccountSession({ data: { sessionId } });
        if (result.status === "reauth_required") {
          window.location.href = "/auth/login?rt=%2Fsettings%2Faccount&maxAge=300";
          return;
        }

        toast.success("Session revoked");
        closeRevokeDialog();
        await refetch();
        await router.invalidate();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to revoke session");
      }
    });
  }

  return (
    <Collapsible.Root open={sessionsOpen} onOpenChange={setSessionsOpen}>
      <SettingsSection
        id="active-sessions"
        title="Active sessions"
        description="See where you’re signed in and revoke old sessions."
        actions={
          <Collapsible.Trigger
            type="button"
            className="group/trigger flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Toggle active sessions"
          >
            <ChevronLeftIcon className="size-4 transition-[rotate] group-data-panel-open/trigger:-rotate-90" />
          </Collapsible.Trigger>
        }
      >
        <Collapsible.Panel>
          <div className="flex flex-col gap-3 border-t pt-5">
            {isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : isError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">Failed to load sessions.</p>
                <p className="text-xs text-muted-foreground">{getQueryErrorMessage(error)}</p>
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions found.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((s) => {
                  const isCurrent = !!currentSessionId && s.id === currentSessionId;
                  const disabled = pending || isCurrent;

                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-md border p-3",
                        isCurrent ? "border-primary/40 bg-primary/5" : "bg-background",
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <AuthMethodBadge authMethod={s.authMethod} />
                            {isCurrent ? <Badge variant="secondary">Current session</Badge> : null}
                            <span className="text-xs text-muted-foreground">{s.status}</span>
                          </div>

                          <div className="text-xs text-muted-foreground">{shortUserAgent(s.userAgent)}</div>

                          <div className="text-xs text-muted-foreground">
                            Created: <span className="text-foreground">{formatDate(s.createdAt)}</span> •
                            Expires: <span className="text-foreground">{formatDate(s.expiresAt)}</span>
                            {s.ipAddress ? (
                              <>
                                {" "}
                                • IP: <span className="text-foreground">{s.ipAddress}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => openRevokeDialog(s.id)}
                            className={cn(isCurrent ? "opacity-50" : undefined)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>

                      {isCurrent ? (
                        <p className="text-xs text-muted-foreground">
                          This is the session you’re currently using. For safety, it can’t be revoked here.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await refetch();
                    toast.success("Sessions refreshed");
                  });
                }}
              >
                Refresh
              </Button>
            </div>

            <RevokeSessionDialog
              open={revokeState.open}
              onOpenChange={(open) => {
                if (!open) closeRevokeDialog();
              }}
              sessionId={revokeState.sessionId}
              onConfirm={revokeSelected}
              pending={pending}
            />
          </div>
        </Collapsible.Panel>
      </SettingsSection>
    </Collapsible.Root>
  );
}
