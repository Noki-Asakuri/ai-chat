import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

export const CHAT_NAVIGATE_TO_THREAD_EVENT = "chat:navigate-to-thread";

export type NavigateToThreadEventDetail = {
  threadId: Id<"threads">;
  source: "notification" | "toast";
};

export function dispatchNavigateToThreadEvent(detail: NavigateToThreadEventDetail): void {
  if (typeof window === "undefined") return;

  const event = new CustomEvent<NavigateToThreadEventDetail>(CHAT_NAVIGATE_TO_THREAD_EVENT, {
    detail,
  });

  window.dispatchEvent(event);
}
