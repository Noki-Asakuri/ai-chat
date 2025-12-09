import { useLoaderData } from "@tanstack/react-router";

import { useChatStore } from "@/lib/chat/store";

export function WelcomeScreen() {
  const { user } = useLoaderData({ from: "/_chat_layout" });
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  return (
    <div
      id="welcome-screen"
      style={{ height: `calc(100% - ${textareaHeight}px)` }}
      className="pointer-events-none absolute flex w-full flex-col items-center justify-center transition-opacity"
    >
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-4xl font-light text-foreground">
          How can I help you, <span className="capitalize">{user?.firstName}</span>?
        </h1>
      </div>
    </div>
  );
}
