import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";
import { toast } from "@/components/ui/toast";

import { useConfigStore } from "../provider/config-provider";
import { ThreadCommandDialog } from "../threads/thread-command";

import { MessageSelectionAction } from "./message-selection-action";

import {
  computeIsAtBottom,
  getMessagesScrollAreaElement,
  scrollToBottom,
  setStickyToBottom,
} from "@/lib/chat/scroll-stickiness";
import { getAttachmentRejectionMessage, prepareAttachmentsForModel } from "@/lib/chat/attachments";
import { focusTextareaByIdAtEnd } from "@/lib/chat/focus-textarea";
import { useAbortChatStream } from "@/lib/chat/server-function/abort-chat-stream";
import { useWindowEvent } from "@/lib/hooks/use-window-event";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";

const NEW_THREAD_KEYBOARD_SHORTCUT = "o";
const THREAD_COMMAND_KEYBOARD_SHORTCUT = "k";
const MODEL_SELECTOR_KEYBOARD_SHORTCUT = "m";
function getIsEditMessage(): boolean {
  return useChatStore.getState().editMessage !== null;
}

function getStatusAndThreadId() {
  const state = useMessageStore.getState();

  const lastId = state.messageIds.at(-1);
  const lastMessage = lastId ? state.messagesById[lastId] : undefined;

  return {
    status: lastMessage?.status ?? "complete",
    threadId: lastMessage?.threadId ?? state.currentThreadId ?? null,
  };
}

export function RegisterEventHandlers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { abortChatStream } = useAbortChatStream();
  const model = useConfigStore((state) => state.model);
  const threadCommandOpen = useThreadStore((state) => state.threadCommandOpen);
  // Handle global paste events
  useWindowEvent("paste", function handlePaste(event) {
    // Handle pasted files
    if (event.clipboardData?.files.length) {
      const target = event.target;

      // If paste is inside either composer textarea, let that component handle it
      if (target instanceof HTMLTextAreaElement) return;

      // Default behavior: add files to the global chat composer
      const files = Array.from(event.clipboardData.files ?? []);

      const { attachments, rejectedCount } = prepareAttachmentsForModel(files, model);

      if (attachments.length > 0) {
        event.preventDefault();
        event.stopPropagation();

        chatStoreActions.addAttachments(attachments);
      }

      if (rejectedCount > 0) {
        toast.error("File type not supported", {
          description: getAttachmentRejectionMessage(model),
        });
      }

      return;
    }

    // If no files were pasted, handle plain text paste into chat input
    const text = event.clipboardData?.getData("text") ?? "";
    if (!text) return;

    const target = event.target;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return;

    const chatInput = document.querySelector<HTMLTextAreaElement>("#textarea-chat-input");
    if (!chatInput) return;

    event.preventDefault();
    event.stopPropagation();

    chatInput.focus();
    chatInput.value += text;
  });

  // Handle global copy events, prevent trailing newline
  useWindowEvent("copy", function handleCopy(event) {
    const selectedText = window.getSelection()?.toString();
    if (!selectedText) return;

    if (navigator?.clipboard) {
      event.preventDefault();
      void navigator.clipboard.writeText(selectedText.trim());
    }
  });

  // Handle global keyboard shortcuts
  useWindowEvent("keydown", async function handleKeyboardShortcut(event) {
    if (event.defaultPrevented || event.isComposing) return;

    const target = event.target;

    const eventKey = event.key.toLowerCase();
    const metaKey = event.metaKey || event.ctrlKey;

    if (eventKey === THREAD_COMMAND_KEYBOARD_SHORTCUT && metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      if (!event.repeat) threadStoreActions.setThreadCommandOpen((open) => !open);
      return;
    }

    if (threadCommandOpen) return;

    const isEditMessage = getIsEditMessage();
    const { status, threadId } = getStatusAndThreadId();

    const shouldFocusTextarea =
      !(target instanceof HTMLTextAreaElement) &&
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLElement && target.isContentEditable);

    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key.length === 1 &&
      shouldFocusTextarea &&
      !event.isComposing
    ) {
      event.preventDefault();

      if (isEditMessage) {
        const editMessage = useChatStore.getState().editMessage;
        if (editMessage) {
          chatStoreActions.updateEditMessage({ input: `${editMessage.input}${event.key}` });
        }
      } else {
        const input = useChatStore.getState().input;
        chatStoreActions.setInput(`${input}${event.key}`);
      }

      const textareaId = isEditMessage ? "textarea-user-message-edit" : "textarea-chat-input";
      focusTextareaByIdAtEnd(textareaId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();

      // 1) If the user is not at the bottom (and not editing), Escape should first scroll to bottom.
      // This prevents accidentally aborting a stream while the user is reading older messages.
      const scrollArea = getMessagesScrollAreaElement();
      const isAtBottom = scrollArea ? computeIsAtBottom(scrollArea) : true;

      if (!isEditMessage && !isAtBottom) {
        if (scrollArea) {
          setStickyToBottom(true);
          scrollToBottom(scrollArea, "smooth");
        }

        focusTextareaByIdAtEnd("textarea-chat-input");

        return;
      }

      // 2) If the user is editing a message, Escape cancels the edit.
      if (isEditMessage) {
        chatStoreActions.setEditMessage(null);
        return;
      }

      // 3) If the user is at the bottom and streaming, Escape aborts the request.
      if (status === "pending" || status === "streaming") {
        if (threadId) await abortChatStream(threadId);
        return;
      }

      // 4) Default: scroll to bottom (no-op if already there) and focus composer.
      if (scrollArea) {
        setStickyToBottom(true);
        scrollToBottom(scrollArea, "smooth");
      }

      focusTextareaByIdAtEnd("textarea-chat-input");

      return;
    }

    if (eventKey === MODEL_SELECTOR_KEYBOARD_SHORTCUT && metaKey) {
      event.preventDefault();
      const targetId = isEditMessage
        ? "button-edit-model-selector-trigger"
        : "button-chat-model-selector-trigger";

      const targetElement = document.getElementById(targetId);
      const btn = targetElement instanceof HTMLButtonElement ? targetElement : null;
      btn?.click();

      // Re-focus the textarea after closing the model selector
      if (btn?.dataset.popupOpen === "") {
        const textareaId = isEditMessage ? "textarea-user-message-edit" : "textarea-chat-input";
        focusTextareaByIdAtEnd(textareaId);
      }

      return;
    }

    if (eventKey === NEW_THREAD_KEYBOARD_SHORTCUT && event.shiftKey && metaKey) {
      event.preventDefault();
      await queryClient.ensureQueryData(convexQuery(api.functions.users.getChatShell));

      await navigate({ to: "/" });
      return;
    }
  });

  return (
    <>
      <MessageSelectionAction />
      {threadCommandOpen && <ThreadCommandDialog />}
    </>
  );
}
