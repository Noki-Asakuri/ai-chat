import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { PlusIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { NavLink, useParams } from "react-router";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { WelcomeScreen } from "@/components/chat/welcome-screen";
import { MessageHistory } from "@/components/message/message-history";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore } from "@/lib/chat/store";
import { fromUUID } from "@/lib/utils";

export function Chat() {
  const resumeRef = useRef<boolean>(false);
  const { threadId } = useParams<{ threadId: Id<"threads"> }>();

  const { data } = useQuery({
    ...convexQuery(api.functions.messages.getAllMessagesFromThread, {
      threadId: fromUUID(threadId),
    }),
  });

  useEffect(() => {
    const state = chatStore.getState();
    if (!data?.messages || data.messages.length === 0) return state.resetState();

    const lastMessage = data.messages.at(-1)!;
    const threadId = lastMessage.threadId;

    console.debug("[Convex] Syncing messages from Convex", { data, threadId });
    state.setDataFromConvex(data.messages, lastMessage.status ?? "complete");

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
    <main className="relative inset-0 h-dvh w-screen overflow-hidden">
      <WelcomeScreen />
      <MessageRenderer thread={data?.thread} />
      <ChatTextarea />
    </main>
  );
}

function MessageRenderer({ thread }: { thread?: Doc<"threads"> | null }) {
  return (
    <>
      <div className="bg-sidebar/80 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar absolute top-0 z-10 flex h-10 w-full items-center justify-start gap-2 border-b border-l px-4 text-sm backdrop-blur-md backdrop-saturate-150">
        <SidebarTrigger />

        <NavLink
          to="/"
          className="hover:bg-primary/20 rounded-md p-1.5 text-center transition-colors"
        >
          <PlusIcon className="size-4" />
          <span className="sr-only">Create new thread</span>
        </NavLink>

        <ThreadTitle thread={thread} />
      </div>

      <MessageHistory />
    </>
  );
}

function ThreadTitle({ thread }: { thread?: Doc<"threads"> | null }) {
  if (thread === null) {
    return <p className="text-muted-foreground text-sm">New Thread</p>;
  }

  if (typeof thread === "undefined") {
    return <Skeleton className="h-4 w-80" />;
  }

  return <p className="text-muted-foreground truncate text-sm">{thread.title}</p>;
}
