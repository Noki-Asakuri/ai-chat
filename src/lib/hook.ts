import { useEffect } from "react";
import { useChatStore } from "./chat/store";
import { useDocumentTitle } from "@uidotdev/usehooks";

const DEFAULT_TITLE = "AI Chat";
export function useThreadUpdateDocumentTitle() {
  const activeThreadId = useChatStore((state) => state.threadId);
  const threads = useChatStore((state) => state.threads);

  const title = threads.find((thread) => thread._id === activeThreadId)?.title;

  useDocumentTitle(title ? `${title} - ${DEFAULT_TITLE}` : DEFAULT_TITLE);
}
