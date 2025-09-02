import { useEffect } from "react";
import { useNavigate } from "react-router";

import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { abortChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";

const THREAD_COMMAND_KEYBOARD_SHORTCUT = "k";
const NEW_THREAD_KEYBOARD_SHORTCUT = "o";

export function RegisterHotkeys() {
  const navigate = useNavigate();

  const status = useChatStore((state) => state.status);
  const editMessage = useChatStore((state) => state.editMessage);

  const setEditMessage = useChatStore((state) => state.setEditMessage);
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);
  const addAttachment = useChatStore((state) => state.addAttachment);
  const setChatInput = useChatStore((state) => state.setChatInput);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      // Route pasted files to the correct composer
      if (event.clipboardData?.files.length) {
        const target = event.target as HTMLTextAreaElement | null;

        // If paste is inside either composer textarea, let that component handle it
        if (
          target &&
          target.tagName === "TEXTAREA" &&
          ["textarea-user-message-edit", "textarea-chat-input"].includes(target.id)
        ) {
          // The respective textarea onPaste will stop propagation and manage files locally
          return;
        }

        // Default behavior: add files to the global chat composer
        const files = Array.from(event.clipboardData.files ?? []);

        const acceptFiles = files.filter(
          (file) => file.type.includes("image") || file.type.includes("pdf"),
        );

        if (acceptFiles.length > 0) {
          event.preventDefault();
          event.stopPropagation();

          const attachments = acceptFiles.map((file) => {
            let type: "image" | "pdf" = "image";
            if (file.type.includes("pdf")) type = "pdf";

            return { id: uuidv4(), name: file.name, size: file.size, file, type };
          });

          addAttachment(attachments);
        }

        if (acceptFiles.length < files.length) {
          toast.error("File type not supported", {
            description: "Please upload an image or PDF file.",
          });
        }

        return;
      }

      // If no files were pasted, handle plain text paste into chat input
      const text = event.clipboardData?.getData("text") ?? "";
      if (!text) return;

      const target = event.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;

      const chatInput = document.querySelector<HTMLTextAreaElement>("#textarea-chat-input");
      if (!chatInput) return;

      event.preventDefault();
      event.stopPropagation();

      chatInput.focus();
      setChatInput((prev) => prev + text);
    }

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
        if (status === "pending" || status === "streaming") {
          event.preventDefault();
          void abortChatRequest();
        } else if (editMessage) {
          event.preventDefault();
          setEditMessage(null);
        } else {
          event.preventDefault();

          const element = document.querySelector("#messages-scrollarea");
          element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });

          const chatInput = document.getElementById("textarea-chat-input");
          if (chatInput) chatInput.focus();
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
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcut);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    editMessage,
    navigate,
    setEditMessage,
    setThreadCommandOpen,
    status,
    addAttachment,
    setChatInput,
  ]);

  return null;
}
