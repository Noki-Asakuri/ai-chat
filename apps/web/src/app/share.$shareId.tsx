import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";
import { makeFunctionReference } from "convex/server";
import { HomeIcon, Loader2Icon, LockIcon } from "lucide-react";
import { useEffect, useMemo } from "react";

import { MessageHistory } from "@/components/message/message-history";
import { Button } from "@/components/ui/button";

import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";

type SharedQueryResult = (typeof api.functions.threadShares.getSharedThread)["_returnType"];
const getSharedThreadRef = makeFunctionReference<
  "query",
  { shareId: string; sessionId?: string },
  SharedQueryResult
>("functions/threadShares:getSharedThread");

type SharedPayload = SharedQueryResult;

export const Route = createFileRoute("/share/$shareId")({
  component: SharedThreadPage,
  loader: async ({ params, context }) => {
    void context.queryClient.prefetchQuery(
      convexQuery(getSharedThreadRef, { shareId: params.shareId }),
    );
  },
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function SharedThreadPage() {
  const params = Route.useParams();

  const { data, error, refetch, isFetching } = useQuery({
    ...convexQuery(getSharedThreadRef, { shareId: params.shareId }),

    retry(failureCount, requestError) {
      const message = requestError.message;
      const noRetryErrors = ["Share access denied", "Shared thread not found"];
      return noRetryErrors.some((item) => message.includes(item)) ? false : failureCount < 2;
    },
  });

  const isDenied = error?.message.includes("Share access denied") ?? false;
  const isNotFound = error?.message.includes("Shared thread not found") ?? false;

  if (isDenied) {
    return <PrivateShareGate shareId={params.shareId} />;
  }

  if (isNotFound) {
    return <ShareNotFound />;
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading shared thread...
        </div>
      </div>
    );
  }

  const payload = data as SharedQueryResult;

  return <SharedThreadViewer data={payload} isFetching={isFetching} onRefresh={refetch} />;
}

function SharedThreadViewer(props: {
  data: SharedPayload;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const data = props.data;
  const isFetching = props.isFetching;
  const onRefresh = props.onRefresh;

  const syncToken = useMemo(() => data.share.updatedAt, [data.share.updatedAt]);

  useEffect(() => {
    messageStoreActions.setCurrentThreadId(data.thread._id);
  }, [data.thread._id]);

  useEffect(() => {
    messageStoreActions.syncMessages(
      data.thread._id,
      {
        messages: data.messages,
        allMessages: data.allMessages,
        variantMessageIdsByUserMessageId: data.variantMessageIdsByUserMessageId,
      },
      syncToken,
      "replace",
    );
  }, [
    data.allMessages,
    data.messages,
    data.thread._id,
    data.variantMessageIdsByUserMessageId,
    syncToken,
  ]);

  const subtitle =
    data.share.mode === "snapshot"
      ? "Snapshot mode: this view is fixed to the shared point in time."
      : "Live mode: this view updates as new messages are added.";

  return (
    <div className="relative min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-medium">{data.thread.title}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onRefresh();
              }}
              disabled={isFetching}
            >
              {isFetching ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Refresh
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/" />}>
              <HomeIcon className="size-4" />
              Home
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto h-[calc(100dvh-61px)] w-full max-w-5xl">
        <ReadOnlyMessageHistory />
      </main>
    </div>
  );
}

function ReadOnlyMessageHistory() {
  const messageCount = useMessageStore((state) => state.messageIds.length);

  if (messageCount === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
        No messages in this shared thread yet.
      </div>
    );
  }

  return <MessageHistory readOnly showUserAvatar={false} bottomPaddingPx={64} />;
}

function PrivateShareGate({ shareId }: { shareId: string }) {
  async function handleSignIn() {
    window.location.href = `/auth/login?rt=${encodeURIComponent(`/share/${shareId}`)}`;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
          <LockIcon className="size-5" />
        </div>

        <h1 className="text-lg font-semibold">Private shared thread</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with an allowed email to view this shared conversation.
        </p>

        <div className="mt-4 flex items-center justify-center gap-2">
          <Button size="sm" onClick={handleSignIn}>
            Sign in
          </Button>

          <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/" />}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShareNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Shared thread not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This share link might be invalid or no longer available.
        </p>

        <div className="mt-4 flex items-center justify-center">
          <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/" />}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
