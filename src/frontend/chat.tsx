import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { useEffect, useRef } from "react";
import { useParams } from "react-router";

import { ChatTextarea } from "@/components/chat/chat-textarea";
import { ChatMessages } from "@/components/message/message";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore } from "@/lib/chat/store";
import { cn, fromUUID } from "@/lib/utils";

export function Chat() {
  const resumeRef = useRef<boolean>(false);
  const { threadId } = useParams<{ threadId: Id<"threads"> }>();

  const { data } = useQuery(
    convexQuery(api.messages.getAllMessagesFromThread, { threadId: fromUUID(threadId) }),
  );

  useEffect(() => {
    const state = chatStore.getState();
    if (!data?.length) return state.resetState();

    const lastMessage = data.at(-1)!;
    const threadId = lastMessage.threadId;

    console.debug("[Convex] Syncing messages from Convex", { data, threadId });
    state.setDataFromConvex(data, lastMessage.status ?? "complete");

    if (
      lastMessage?.resumableStreamId &&
      lastMessage.status === "streaming" &&
      !state.isStreaming &&
      !resumeRef.current
    ) {
      resumeRef.current = true;
      console.debug("[Convex] Resuming chat streaming", {
        threadId,
        streamId: lastMessage.resumableStreamId,
      });
      void sendChatRequest(
        `/api/ai/chat?streamId=${lastMessage.resumableStreamId}`,
        undefined,
        lastMessage._id,
      );
      resumeRef.current = false;
    }
  }, [data]);

  return (
    <main
      className={cn(
        "bg-background relative flex h-dvh w-screen flex-1 flex-col transition-[margin-top,border-radius,height]",
        "peer-data-[state=collapsed]:mt-0 peer-data-[state=collapsed]:h-dvh peer-data-[state=collapsed]:rounded-none",
        "md:mt-3 md:h-[calc(100dvh-12px)] md:rounded-tl-2xl",
      )}
    >
      <ChatMessages />
      <ChatTextarea />
    </main>
  );
}
