import { api } from "@ai-chat/backend/convex/_generated/api";

import { createFileRoute } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";
import { useEffect } from "react";
import { useShallow } from "zustand/shallow";

import { useChatStore } from "@/lib/store/chat-store";
import { messageStoreActions } from "@/lib/store/messages-store";

export const Route = createFileRoute("/_chat_layout/")({
  component: RouteComponent,
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(
      convexQuery(api.functions.users.getCurrentUserPreferences, {
        sessionId: context.sessionId,
      }),
    );

    return { user: context.user };
  },
});

function RouteComponent() {
  useEffect(() => {
    messageStoreActions.clearMessages();
    messageStoreActions.setCurrentThreadId(null);
  }, []);

  return <WelcomeScreen />;
}

export function WelcomeScreen() {
  const { user } = Route.useLoaderData();

  const { textareaHeight, input } = useChatStore(
    useShallow((state) => ({ input: state.input, textareaHeight: state.textareaHeight })),
  );

  return (
    <div
      id="welcome-screen"
      data-invisible={!!input.length}
      style={{ height: `calc(100% - ${textareaHeight}px)` }}
      className="pointer-events-none absolute flex w-full items-center justify-center opacity-100 transition-opacity data-[invisible=true]:opacity-0"
    >
      <h1 className="text-center text-4xl font-light text-foreground">
        What can I help you with today,{" "}
        <span className="capitalize">{user?.firstName ?? "user"}</span>?
      </h1>
    </div>
  );
}
