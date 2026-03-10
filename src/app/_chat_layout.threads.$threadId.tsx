import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useRef } from "react";

import { LoadingSkeleton } from "@/components/chat/loading-skeleton";
import { MessageHistory } from "@/components/message/message-history";

import { setStickyToBottom } from "@/lib/chat/scroll-stickiness";
import { useAutoResumeStream } from "@/lib/chat/server-function/auto-resume-stream";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { messageStoreActions } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";
import { fromUUID } from "@/lib/utils";

type ChatHistoryPayload = {
  messages: ChatMessage[];
  allMessages?: ChatMessage[];
  variantMessageIdsByUserMessageId?: Record<Id<"messages">, Array<Id<"messages">>>;
};

type SyncMode = "replace" | "prepend";

export const Route = createFileRoute("/_chat_layout/threads/$threadId")({
  component: ChatComponentPage,
  pendingComponent: LoadingSkeleton,

  loader: async ({ context, params }) => {
    const threadId = fromUUID<Id<"threads">>(params.threadId);

    await context.queryClient.prefetchQuery(
      convexQuery(api.functions.users.getCurrentUserPreferences, {
        sessionId: context.sessionId!,
        threadId,
      }),
    );

    void context.queryClient.prefetchQuery(
      convexQuery(api.functions.messages.getAllMessagesFromThread, {
        threadId: fromUUID<Id<"threads">>(params.threadId),
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

  return <ChatHistory />;
}

function ChatHistory() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId" });
  const threadId = fromUUID<Id<"threads">>(params.threadId);
  const shouldForceScrollToBottomRef = useRef(true);

  const { autoResumeStream } = useAutoResumeStream();

  const { data, dataUpdatedAt } = useSuspenseQuery({
    ...convexSessionQuery(api.functions.messages.getAllMessagesFromThread, { threadId }),
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

      if (skipFollowUps) return;

      const lastMessage = payload.messages[payload.messages.length - 1];
      if (!lastMessage) return;

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
    shouldForceScrollToBottomRef.current = true;
    setStickyToBottom(true);
  }, [threadId]);

  useEffect(() => {
    if (data) {
      syncMessage(
        {
          messages: data.messages,
          allMessages: data.allMessages,
          variantMessageIdsByUserMessageId: data.variantMessageIdsByUserMessageId,
        },
        dataUpdatedAt,
        { mode: "replace" },
      );

      if (shouldForceScrollToBottomRef.current) {
        shouldForceScrollToBottomRef.current = false;

        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("chat:force-scroll-bottom"));
        });
      }
    }
  }, [data, dataUpdatedAt]);

  return <MessageHistory />;
}
