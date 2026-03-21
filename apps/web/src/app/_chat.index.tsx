import { motion, useReducedMotion } from "motion/react";
import { api } from "@ai-chat/backend/convex/_generated/api";

import { createFileRoute } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";
import { useEffect } from "react";
import { useShallow } from "zustand/shallow";

import { useChatStore } from "@/lib/store/chat-store";
import { messageStoreActions } from "@/lib/store/messages-store";

export const Route = createFileRoute("/_chat/")({
  component: RouteComponent,
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(
      convexQuery(api.functions.users.getCurrentUserPreferences),
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
  const prefersReducedMotion = useReducedMotion() ?? false;

  const { textareaHeight, input } = useChatStore(
    useShallow((state) => ({ input: state.input, textareaHeight: state.textareaHeight })),
  );

  return (
    <div
      id="welcome-screen"
      data-invisible={input.length > 0}
      style={{ height: `calc(100% - ${textareaHeight}px)` }}
      className="pointer-events-none absolute flex w-full items-center justify-center opacity-100 transition-opacity data-[invisible=true]:opacity-0"
    >
      <motion.div
        key="welcome-screen"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? undefined : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-center text-4xl font-light text-foreground">
          What can I help you with today,{" "}
          <span className="capitalize">{user?.firstName ?? "user"}</span>?
        </h1>
      </motion.div>
    </div>
  );
}
