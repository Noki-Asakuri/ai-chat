import { useQuery } from "@tanstack/react-query";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronLeftIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { listAccountSessions, revokeAccountSession } from "@/lib/authkit/accountServerFunctions";
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
  const { sessionId: currentSessionId } = useLoaderData({ from: "__root__" });

  const { data, error, isError, isPending, refetch } = useQuery({
    queryKey: ["account-sessions"],
    queryFn: async () => await listAccountSessions(),
  });

  const [revokeState, setRevokeState] = useState<RevokeDialogState>({
    open: false,
    sessionId: null,
  });
  const [pending, startTransition] = useTransition();

  const rows = useMemo<Array<AccountSessionRow>>(() => {
    const result: Array<AccountSessionRow> = [];
    for (const s of data?.sessions ?? []) {
      result.push({
        id: s.id,
        authMethod: s.authMethod,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        status: s.status,
      });
    }
    return result;
  }, [data?.sessions]);

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
      const promise = revokeAccountSession({ data: { sessionId } });

      toast.promise(promise, {
        loading: "Revoking session...",
        success: "Session revoked",
        error: (err) => (err instanceof Error ? err.message : "Failed to revoke session"),
      });

      await promise;
      closeRevokeDialog();
      await refetch();
      await router.invalidate();
    });
  }

  return (
    <Collapsible.Root defaultOpen={false}>
      <Card className="rounded-md">
        <CardHeader className="grid-rows-1">
          <Collapsible.Trigger
            type="button"
            className="group/trigger flex w-full items-start justify-between gap-4 text-left"
          >
            <div className="space-y-1">
              <CardTitle>Active sessions</CardTitle>
              <CardDescription>See where you’re signed in and revoke old sessions.</CardDescription>
            </div>

            <ChevronLeftIcon className="mt-1 size-4 shrink-0 transition-[rotate] group-data-panel-open/trigger:-rotate-90" />
          </Collapsible.Trigger>
        </CardHeader>

        <Collapsible.Panel>
          <CardContent className="space-y-3">
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

                          <div className="text-xs text-muted-foreground">
                            {shortUserAgent(s.userAgent)}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Created:{" "}
                            <span className="text-foreground">{formatDate(s.createdAt)}</span> •
                            Expires:{" "}
                            <span className="text-foreground">{formatDate(s.expiresAt)}</span>
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
                          This is the session you’re currently using. For safety, it can’t be
                          revoked here.
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
          </CardContent>
        </Collapsible.Panel>
      </Card>
    </Collapsible.Root>
  );
}
