import { useNavigate } from "@tanstack/react-router";

import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { useWindowEvent } from "@/lib/hooks/use-window-event";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import { threadStoreActions } from "@/lib/store/thread-store";
import type { UserAttachment } from "@/lib/types";

const NEW_THREAD_KEYBOARD_SHORTCUT = "o";
const THREAD_COMMAND_KEYBOARD_SHORTCUT = "k";
const MODEL_SELECTOR_KEYBOARD_SHORTCUT = "m";

export function RegisterHotkeys() {
  const navigate = useNavigate();

  const isEditMessage = useChatStore((state) => state.editMessageId !== null);
  const status = useMessageStore(
    (state) => state.messagesById[state.messageIds.at(-1)!]?.status ?? "complete",
  );

  useWindowEvent("paste", function handlePaste(event) {
    // Handle pasted files
    if (event.clipboardData?.files.length) {
      const target = event.target as HTMLTextAreaElement | null;

      // If paste is inside either composer textarea, let that component handle it
      if (target && target.tagName === "TEXTAREA") return;

      // Default behavior: add files to the global chat composer
      const files = Array.from(event.clipboardData.files ?? []);

      const acceptFiles = files.filter(
        (file) => file.type.includes("image") || file.type.includes("pdf"),
      );

      if (acceptFiles.length > 0) {
        event.preventDefault();
        event.stopPropagation();

        const attachments = acceptFiles.map((file): UserAttachment => {
          return { id: uuidv4(), file, type: file.type.includes("image") ? "image" : "pdf" };
        });

        chatStoreActions.addAttachments(attachments);
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
    chatInput.value += text;
  });

  useWindowEvent("keydown", function handleKeyboardShortcut(event) {
    const target = event.target as HTMLElement;

    const eventKey = event.key.toLowerCase();
    const metaKey = event.metaKey || event.ctrlKey;

    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key.length === 1 &&
      target.tagName !== "INPUT" &&
      target.tagName !== "TEXTAREA" &&
      !target.isContentEditable
    ) {
      const textareId = isEditMessage ? "textarea-user-message-edit" : "textarea-chat-input";
      const chatInput = document.getElementById(textareId);

      if (chatInput) chatInput.focus();
    }

    if (event.key === "Escape") {
      if (status === "pending" || status === "streaming") {
        event.preventDefault();
        // void abortChatRequest();
      }

      //
      else if (isEditMessage) {
        event.preventDefault();
        chatStoreActions.setEditMessageId(null);
      }

      //
      else {
        event.preventDefault();

        const element = document.querySelector("#messages-scrollarea");
        element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });

        const chatInput = document.getElementById("textarea-chat-input");
        if (chatInput) chatInput.focus();
      }

      return;
    }

    if (eventKey === THREAD_COMMAND_KEYBOARD_SHORTCUT && metaKey) {
      event.preventDefault();
      threadStoreActions.setThreadCommandOpen((open) => !open);

      return;
    }

    if (eventKey === MODEL_SELECTOR_KEYBOARD_SHORTCUT && metaKey) {
      event.preventDefault();
      const targetId = isEditMessage
        ? "button-edit-model-selector-trigger"
        : "button-chat-model-selector-trigger";

      const btn = document.getElementById(targetId) as HTMLButtonElement | null;
      btn?.click();

      // Re-focus the textarea after closing the model selector
      if (btn?.dataset.popupOpen === "") {
        const textareId = isEditMessage ? "textarea-user-message-edit" : "textarea-chat-input";
        const textarea = document.getElementById(textareId) as HTMLTextAreaElement | null;

        textarea?.focus();
      }

      return;
    }

    if (eventKey === NEW_THREAD_KEYBOARD_SHORTCUT && event.shiftKey && metaKey) {
      event.preventDefault();
      navigate({ to: "/" });

      return;
    }
  });

  return null;
}
