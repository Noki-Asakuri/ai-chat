import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useLoaderData, useParams } from "@tanstack/react-router";
import { Suspense, useEffect, useEffectEvent, useState } from "react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { LoadingSkeleton } from "@/components/chat/loading-skeleton";
import { MessageHistory } from "@/components/message/message-history";
import { buildMessageUserIdentity } from "@/components/message/message-identity";
import { useConfigStoreState } from "@/components/provider/config-provider";

import { useAutoResumeStream } from "@/lib/chat/server-function/auto-resume-stream";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";
import { fromUUID } from "@/lib/utils";

const THREAD_HISTORY_PAGE_SIZE = 60;

type ChatHistoryPayload = {
  messages: ChatMessage[];
  allMessages?: ChatMessage[];
  variantMessageIdsByUserMessageId?: Record<Id<"messages">, Array<Id<"messages">>>;
};

type SyncMode = "replace" | "prepend";

export const Route = createFileRoute("/_chat_layout/threads/$threadId")({
  component: ChatComponentPage,
  loader: async ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      convexQuery(api.functions.messages.getAllMessagesFromThread, {
        threadId: fromUUID<Id<"threads">>(params.threadId),
        limit: THREAD_HISTORY_PAGE_SIZE,
        sessionId: context.sessionId,
      }),
    );
  },
});

function ChatComponentPage() {
  const params = Route.useParams();

  useEffect(() => {
    messageStoreActions.setCurrentThreadId(fromUUID<Id<"threads">>(params.threadId));
  }, [params.threadId]);

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ChatHistory />
      <ChatTextarea key="main-chat-textarea" />
    </Suspense>
  );
}

function ChatHistory() {
  const { user } = useLoaderData({ from: "/_chat_layout" });
  const params = useParams({ from: "/_chat_layout/threads/$threadId" });
  const threadId = fromUUID<Id<"threads">>(params.threadId);
  const { autoResumeStream } = useAutoResumeStream();
  const configStore = useConfigStoreState();
  const userIdentity = buildMessageUserIdentity(user);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [hasLoadedOlderPages, setHasLoadedOlderPages] = useState(false);
  const [olderBeforeCreatedAt, setOlderBeforeCreatedAt] = useState<number | null>(null);

  const earliestVisibleMessageCreatedAt = useMessageStore((state) => {
    const earliestMessageId = state.messageIds[0];
    if (!earliestMessageId) return null;

    return state.messagesById[earliestMessageId]?.createdAt ?? null;
  });

  const { data, dataUpdatedAt } = useSuspenseQuery({
    ...convexSessionQuery(api.functions.messages.getAllMessagesFromThread, {
      threadId,
      limit: THREAD_HISTORY_PAGE_SIZE,
    }),
    retry(failureCount, error) {
      const ignoreErrors = ["Thread not found", "Not authorized", "Not authenticated"];
      return ignoreErrors.some((e) => error.message.includes(e)) ? false : failureCount < 3;
    },
  });

  const {
    data: olderData,
    dataUpdatedAt: olderDataUpdatedAt,
    isFetching: isLoadingOlderMessages,
  } = useQuery({
    ...convexSessionQuery(
      api.functions.messages.getAllMessagesFromThread,
      olderBeforeCreatedAt === null
        ? "skip"
        : {
            threadId,
            limit: THREAD_HISTORY_PAGE_SIZE,
            beforeCreatedAt: olderBeforeCreatedAt,
          },
    ),
    retry(failureCount, error) {
      const ignoreErrors = ["Thread not found", "Not authorized", "Not authenticated"];
      return ignoreErrors.some((e) => error.message.includes(e)) ? false : failureCount < 3;
    },
  });

  const syncMessage = useEffectEvent(
    (
      payload: ChatHistoryPayload,
      syncToken: number,
      options: { mode?: SyncMode; skipFollowUps?: boolean } = {},
    ) => {
      const mode = options.mode ?? "replace";
      const skipFollowUps = options.skipFollowUps ?? false;

      messageStoreActions.syncMessages(threadId, payload, syncToken, mode);

      if (skipFollowUps) {
        return;
      }

      const lastMessage = payload.messages[payload.messages.length - 1];
      if (!lastMessage) return;

      if (lastMessage.metadata) {
        configStore.setConfig({
          model: lastMessage.metadata.model.request,
          ...lastMessage.metadata.modelParams,
        });
      }

      if (lastMessage.status === "streaming" && lastMessage.resumableStreamId) {
        void autoResumeStream(lastMessage.resumableStreamId, lastMessage._id);
      }

      // Clear any active controller if the stream has completed or errored
      if (lastMessage.status === "complete" || lastMessage.status === "error") {
        messageStoreActions.removeController(lastMessage.threadId);
      }

      // Auto scroll to bottom when new messages are added (only if user is already at bottom)
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("chat:scroll-if-sticky"));
      });
    },
  );

  useEffect(() => {
    if (data) {
      syncMessage(
        {
          messages: data.messages,
          allMessages: data.allMessages,
          variantMessageIdsByUserMessageId: data.variantMessageIdsByUserMessageId,
        },
        dataUpdatedAt,
        { mode: hasLoadedOlderPages ? "prepend" : "replace" },
      );

      setHasOlderMessages(data.hasOlderMessages);
    }
  }, [data, dataUpdatedAt, hasLoadedOlderPages]);

  useEffect(() => {
    if (!olderData || olderBeforeCreatedAt === null) return;

    syncMessage(
      {
        messages: olderData.messages,
        allMessages: olderData.allMessages,
        variantMessageIdsByUserMessageId: olderData.variantMessageIdsByUserMessageId,
      },
      olderDataUpdatedAt,
      { mode: "prepend", skipFollowUps: true },
    );

    setHasOlderMessages(olderData.hasOlderMessages);
    setHasLoadedOlderPages(true);
    setOlderBeforeCreatedAt(null);
  }, [olderData, olderDataUpdatedAt, olderBeforeCreatedAt]);

  useEffect(() => {
    setOlderBeforeCreatedAt(null);
    setHasLoadedOlderPages(false);
    setHasOlderMessages(false);
  }, [threadId]);

  function handleLoadOlderMessages(): void {
    if (!hasOlderMessages || isLoadingOlderMessages) return;
    if (earliestVisibleMessageCreatedAt === null) return;

    setOlderBeforeCreatedAt(earliestVisibleMessageCreatedAt);
  }

  return (
    <MessageHistory
      hasOlderMessages={hasOlderMessages}
      isLoadingOlderMessages={isLoadingOlderMessages}
      onLoadOlderMessages={handleLoadOlderMessages}
      userIdentity={userIdentity}
    />
  );
}
