import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { useEffect, useRef } from "react";
import { useParams } from "react-router";

import { ChatTextarea } from "@/components/chat/chat-textarea";
import { MessageHistory } from "@/components/message/message-history";
import { useSidebar } from "@/components/ui/sidebar";
import { WelcomeScreen } from "@/components/welcome-screen";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore } from "@/lib/chat/store";
import { cn, fromUUID } from "@/lib/utils";

export function Chat() {
  const resumeRef = useRef<boolean>(false);
  const { threadId } = useParams<{ threadId: Id<"threads"> }>();

  const { data } = useQuery(
    convexQuery(api.functions.messages.getAllMessagesFromThread, { threadId: fromUUID(threadId) }),
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
    <main className="relative inset-0 h-dvh w-screen overflow-hidden">
      <SidebarPushdown />

      <WelcomeScreen />
      <MessageHistory />
      <ChatTextarea />
    </main>
  );
}

function SidebarPushdown() {
  const { state, isMobile } = useSidebar();

  const user = useQuery(convexQuery(api.functions.users.currentUser, {}));
  const hasBackground = typeof user?.data?.customization?.backgroundId === "string";

  return (
    <>
      <div
        data-slot="sidebar-pushdown"
        className={cn(
          "group-data-[disable-blur=true]/sidebar-provider:bg-sidebar pointer-events-none absolute z-10 flex h-3 w-full items-center justify-between backdrop-blur-md backdrop-saturate-150 transition-[height]",
          { "h-0": state === "collapsed" || isMobile },
        )}
      >
        <div className="from-sidebar/95 h-full w-1/3 bg-gradient-to-r from-20% via-[rgba(32,32,32,0.7)] to-transparent group-data-[disable-blur=true]/sidebar-provider:hidden" />
        <div className="from-sidebar/95 h-full w-1/3 bg-gradient-to-l from-20% via-[rgba(32,32,32,0.7)] to-transparent group-data-[disable-blur=true]/sidebar-provider:hidden" />

        <div
          className={cn(
            "border-sidebar-accent absolute top-3 h-[calc(100svh-12px)] w-full rounded-tl-3xl border-t border-l transition-[top,border-color] will-change-[top,border-color]",
            { "top-0 h-svh rounded-none border-transparent": state === "collapsed" || isMobile },
          )}
        />
      </div>

      <div className="bg-sidebar pointer-events-none absolute inset-0 backdrop-blur-md backdrop-saturate-150" />

      <div
        data-slot="sidebar-pushdown-background"
        className={cn(
          "bg-background absolute inset-0 mt-3 rounded-tl-3xl bg-cover bg-fixed bg-center bg-no-repeat transition-[margin-top,border-radius,border-color] will-change-[margin-top,border-radius]",
          { "mt-0 rounded-none": state === "collapsed" || isMobile },
          { "bg-transparent": hasBackground },
        )}
        style={{
          backgroundImage: user?.data?.customization?.backgroundId
            ? `url(https://ik.imagekit.io/gmethsnvl/ai-chat/${user.data.customization.backgroundId})`
            : undefined,
        }}
      />
    </>
  );
}
