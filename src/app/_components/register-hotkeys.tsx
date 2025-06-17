import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useChatStore } from "@/lib/chat/store";
import { abortChatRequest } from "@/lib/chat/send-chat-request";

const THREAD_COMMAND_KEYBOARD_SHORTCUT = "k";
const NEW_THREAD_KEYBOARD_SHORTCUT = "n";

export function RegisterHotkeys() {
  const router = useRouter();
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);
  const abortController = useChatStore((state) => state.abortController);
  const status = useChatStore((state) => state.status);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const editMessage = useChatStore((state) => state.editMessage);
  const setEditMessage = useChatStore((state) => state.setEditMessage);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.length === 1 &&
        target.tagName !== "INPUT" &&
        target.tagName !== "TEXTAREA" &&
        !target.isContentEditable
      ) {
        const chatInput = document.getElementById("textarea-chat-input");
        if (chatInput) chatInput.focus();
      }

      if (event.key === "Escape") {
        if (status === "pending" || isStreaming) {
          void abortChatRequest();
        } else if (editMessage) {
          setEditMessage(null);
        }
      }

      if (
        event.key.toLowerCase() === THREAD_COMMAND_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setThreadCommandOpen((open) => !open);
      }

      if (
        event.key.toLowerCase() === NEW_THREAD_KEYBOARD_SHORTCUT &&
        event.shiftKey &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        router.push("/");
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [
    router,
    setThreadCommandOpen,
    abortController,
    status,
    isStreaming,
    editMessage,
    setEditMessage,
  ]);

  return null;
}
