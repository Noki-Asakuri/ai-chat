"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";

import dynamic from "next/dynamic";
import { redirect, useParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore, useChatStore } from "@/lib/chat/store";
import { fromUUID } from "@/lib/utils";

const ChatTextarea = dynamic(
  () => import("@/components/chat/chat-textarea").then((d) => d.ChatTextarea),
  {
    ssr: false,
  },
);
const ThreadSidebar = dynamic(
  () => import("@/components/threads/thread-sidebar").then((d) => d.ThreadSidebar),
  { ssr: false },
);

function Chat({ children }: { children: React.ReactNode }) {
  const params = useParams<{ threadId?: string }>();
  const threadId = useChatStore((state) => state.threadId);

  const resumeRef = useRef<boolean>(false);
  const setThreadId = useChatStore((state) => state.setThreadId);

  const data = useQuery(api.messages.getAllMessagesFromThread, {
    threadId: fromUUID<Id<"threads">>(threadId),
  });

  useEffect(() => {
    if (threadId !== params.threadId) {
      console.debug("[Thread] Setting thread id", params.threadId);
      setThreadId(fromUUID<Id<"threads">>(params.threadId));
    }
  }, [params.threadId, setThreadId, threadId]);

  useEffect(() => {
    const state = chatStore.getState();
    if (!data?.length) return state.resetState();

    const lastMessage = data.at(-1)!;
    const threadId = lastMessage.threadId;

    console.debug("[Convex] Syncing messages from Convex", { data, threadId });
    state.setDataFromConvex(data, lastMessage.status ?? "complete", lastMessage.threadId);

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
    <div className="grid h-svh max-w-screen overflow-x-hidden lg:grid-cols-[280px_1fr]">
      <ThreadSidebar />

      <div className="border-border relative mt-3 flex h-[calc(100vh-12px)] max-w-screen flex-col rounded-tl-2xl border-t border-l pt-6">
        {children}
        <ChatTextarea />
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Authenticated>
        <Chat>{children}</Chat>
      </Authenticated>

      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
    </>
  );
}

function RedirectToSignIn() {
  return redirect("/auth/login");
}
