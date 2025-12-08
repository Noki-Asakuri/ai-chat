import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { abortChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore, useChatStore } from "@/lib/chat/store";
import { threadStore } from "@/lib/store/thread-store";

const NEW_THREAD_KEYBOARD_SHORTCUT = "o";
const THREAD_COMMAND_KEYBOARD_SHORTCUT = "k";
const MODEL_SELECTOR_KEYBOARD_SHORTCUT = "m";

export function RegisterHotkeys() {
  const navigate = useNavigate();

  const editMessage = useChatStore((state) => state.editMessage);
  const status = useChatStore((state) => state.messages.at(-1)?.status ?? "complete");

  const { setEditMessage, addAttachment, setChatInput } = chatStore.getState();

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

            return {
              id: uuidv4(),
              name: file.name,
              size: file.size,
              file,
              type,
              mimeType: file.type,
            };
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
        const chatInput = document.getElementById(
          editMessage ? "textarea-user-message-edit" : "textarea-chat-input",
        );
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
        threadStore.getState().setThreadCommandOpen((open) => !open);
      }

      if (
        event.key.toLowerCase() === MODEL_SELECTOR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        const targetId = editMessage
          ? "button-edit-model-selector-trigger"
          : "button-chat-model-selector-trigger";

        const btn = document.getElementById(targetId) as HTMLButtonElement | null;
        btn?.click();

        // Re-focus the textarea after closing the model selector
        if (btn?.dataset.popupOpen === "") {
          const textareId = editMessage ? "textarea-user-message-edit" : "textarea-chat-input";
          const textarea = document.getElementById(textareId) as HTMLTextAreaElement | null;
          textarea?.focus();
        }
      }

      if (
        event.key.toLowerCase() === NEW_THREAD_KEYBOARD_SHORTCUT &&
        event.shiftKey &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        navigate({ to: "/" });
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcut);
      window.removeEventListener("paste", onPaste);
    };
  }, [editMessage, navigate, setEditMessage, addAttachment, setChatInput]);

  return null;
}
