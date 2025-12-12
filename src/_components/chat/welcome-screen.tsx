import { useLoaderData } from "@tanstack/react-router";
import { useShallow } from "zustand/shallow";

import { useChatStore } from "@/lib/store/chat-store";

export function WelcomeScreen() {
  const { user } = useLoaderData({ from: "/_chat_layout" });

  const { textareaHeight, input } = useChatStore(
    useShallow((state) => ({ input: state.input.length, textareaHeight: state.textareaHeight })),
  );

  return (
    <div
      id="welcome-screen"
      data-invisible={!!input}
      style={{ height: `calc(100% - ${textareaHeight}px)` }}
      className="pointer-events-none absolute flex w-full items-center justify-center opacity-100 transition-opacity data-[invisible=true]:opacity-0"
    >
      <h1 className="text-4xl font-light text-foreground">
        How can I help you, <span className="capitalize">{user?.firstName}</span>?
      </h1>
    </div>
  );
}
