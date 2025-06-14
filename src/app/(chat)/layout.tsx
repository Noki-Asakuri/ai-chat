"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";

import dynamic from "next/dynamic";
import { redirect, useParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { LoadingPage } from "@/components/loading-page";
import { RegisterHotkeys } from "@/components/register-hotkeys";
import { ThreadGroupButtons } from "@/components/threads/thread-group-buttons";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore, useChatStore } from "@/lib/chat/store";
import { cn, fromUUID } from "@/lib/utils";

const ChatTextarea = dynamic(
  () => import("@/components/chat/chat-textarea").then((d) => d.ChatTextarea),
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
    <SidebarProvider className="bg-sidebar">
      <ThreadSidebar />
      <ThreadGroupButtons />

      <main
        className={cn(
          "bg-background relative flex h-dvh w-screen flex-1 flex-col transition-[margin-top,border-radius,height]",
          "peer-data-[state=collapsed]:mt-0 peer-data-[state=collapsed]:h-dvh peer-data-[state=collapsed]:rounded-none",
          "md:mt-3 md:h-[calc(100dvh-12px)] md:rounded-tl-2xl",
        )}
      >
        {children}
        <ChatTextarea />
      </main>

      <RegisterHotkeys />
    </SidebarProvider>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Authenticated>
        <Chat children={children} />
      </Authenticated>

      <AuthLoading>
        <LoadingPage />
      </AuthLoading>

      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
    </>
  );
}

function RedirectToSignIn() {
  return redirect("/auth/login");
}
