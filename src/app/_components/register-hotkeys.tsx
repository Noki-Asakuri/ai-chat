import { useEffect } from "react";
import { useNavigate } from "react-router";

import { abortChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";

const THREAD_COMMAND_KEYBOARD_SHORTCUT = "k";
const NEW_THREAD_KEYBOARD_SHORTCUT = "o";

export function RegisterHotkeys() {
  const navigate = useNavigate();

  const status = useChatStore((state) => state.status);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const editMessage = useChatStore((state) => state.editMessage);

  const setEditMessage = useChatStore((state) => state.setEditMessage);
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);

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
          event.preventDefault();
          void abortChatRequest();
        } else if (editMessage) {
          event.preventDefault();
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
        void navigate("/");
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [editMessage, isStreaming, navigate, setEditMessage, setThreadCommandOpen, status]);

  return null;
}
