import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";
import { MessageSquarePlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { ButtonWithTip } from "../ui/button";

import {
  computeIsAtBottom,
  getMessagesScrollAreaElement,
  scrollToBottom,
  scrollToBottomIfStickyRaf,
  setStickyToBottom,
} from "@/lib/chat/scroll-stickiness";
import { focusTextareaByIdAtEnd } from "@/lib/chat/focus-textarea";
import { useAbortChatStream } from "@/lib/chat/server-function/abort-chat-stream";
import { useWindowEvent } from "@/lib/hooks/use-window-event";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import { threadStoreActions } from "@/lib/store/thread-store";
import type { UserAttachment } from "@/lib/types";

const NEW_THREAD_KEYBOARD_SHORTCUT = "o";
const THREAD_COMMAND_KEYBOARD_SHORTCUT = "k";
const MODEL_SELECTOR_KEYBOARD_SHORTCUT = "m";
const MAX_SELECTED_CONTEXT_LENGTH = 4000;
const MESSAGE_HISTORY_SELECTOR = "[data-slot='message-history']";
const ASSISTANT_MESSAGE_SELECTOR = "[data-slot='message'][data-role='assistant']";
const SELECTION_ACTION_WIDTH_PX = 132;
const SELECTION_ACTION_HEIGHT_PX = 28;
const SELECTION_ACTION_GAP_PX = 8;

type SelectionActionState = {
  text: string;
  left: number;
  top: number;
};

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

function getSelectedTextContext(): string | null {
  const selectedText = window.getSelection()?.toString().trim();
  if (!selectedText) return null;

  return selectedText.length > MAX_SELECTED_CONTEXT_LENGTH
    ? `${selectedText.slice(0, MAX_SELECTED_CONTEXT_LENGTH).trimEnd()}...`
    : selectedText;
}

function getSelectionElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node instanceof HTMLElement) return node;

  return node.parentElement;
}

function getSelectionAssistantMessage(selection: Selection): HTMLElement | null {
  const anchorElement = getSelectionElement(selection.anchorNode);
  const focusElement = getSelectionElement(selection.focusNode);
  if (!anchorElement || !focusElement) return null;

  const anchorMessage = anchorElement.closest(ASSISTANT_MESSAGE_SELECTOR);
  const focusMessage = focusElement.closest(ASSISTANT_MESSAGE_SELECTOR);
  if (!(anchorMessage instanceof HTMLElement)) return null;

  return anchorMessage === focusMessage ? anchorMessage : null;
}

function getSelectionRect(selection: Selection): DOMRect | null {
  if (selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) return rect;

  const firstRect = range.getClientRects().item(0);
  return firstRect;
}

function getSelectionActionState(): SelectionActionState | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;

  const text = getSelectedTextContext();
  if (!text) return null;

  const assistantMessage = getSelectionAssistantMessage(selection);
  if (!assistantMessage) return null;

  const rect = getSelectionRect(selection);
  if (!rect) return null;

  const historyElement = assistantMessage.closest(MESSAGE_HISTORY_SELECTOR);
  if (!(historyElement instanceof HTMLElement)) return null;

  const historyRect = historyElement.getBoundingClientRect();
  const minLeft = historyRect.left + SELECTION_ACTION_WIDTH_PX / 2 + SELECTION_ACTION_GAP_PX;
  const maxLeft = historyRect.right - SELECTION_ACTION_WIDTH_PX / 2 - SELECTION_ACTION_GAP_PX;
  const minTop = historyRect.top + SELECTION_ACTION_GAP_PX;
  const maxTop = historyRect.bottom - SELECTION_ACTION_HEIGHT_PX - SELECTION_ACTION_GAP_PX;
  const preferredTop = rect.bottom + SELECTION_ACTION_GAP_PX;

  return {
    text,
    left: Math.min(Math.max(rect.left + rect.width / 2, minLeft), maxLeft),
    top: Math.min(Math.max(preferredTop, minTop), maxTop),
  };
}

function formatSelectedTextBlockquote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function appendSelectedTextBlockquote(input: string, text: string): string {
  const blockquote = formatSelectedTextBlockquote(text);
  if (!input.trim()) return `${blockquote}\n\n`;

  return `${input.trimEnd()}\n\n${blockquote}\n\n`;
}

export function RegisterEventHandlers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { abortChatStream } = useAbortChatStream();
  const [selectionAction, setSelectionAction] = useState<SelectionActionState | null>(null);

  function updateSelectionAction() {
    if (getIsEditMessage()) {
      setSelectionAction(null);
      return;
    }

    setSelectionAction(getSelectionActionState());
  }

  function handleAddSelectedTextContext() {
    if (!selectionAction) return;

    const input = useChatStore.getState().input;
    chatStoreActions.setInput(appendSelectedTextBlockquote(input, selectionAction.text));
    chatStoreActions.setSelectedBlockquoteContext({ text: selectionAction.text });

    setSelectionAction(null);
    window.getSelection()?.removeAllRanges();
    focusTextareaByIdAtEnd("textarea-chat-input");
  }

  useWindowEvent("selectionchange", updateSelectionAction);
  useWindowEvent("mouseup", updateSelectionAction);
  useWindowEvent("keyup", updateSelectionAction);
  useWindowEvent("scroll", () => setSelectionAction(null), { capture: true });

  // Handle global paste events
  useWindowEvent("paste", function handlePaste(event) {
    // Handle pasted files
    if (event.clipboardData?.files.length) {
      const target = event.target as HTMLTextAreaElement | null;

      // If paste is inside either composer textarea, let that component handle it
      if (target && target.tagName === "TEXTAREA") return;

      // Default behavior: add files to the global chat composer
      const files = Array.from(event.clipboardData.files ?? []);

      const acceptFiles = files.filter((file) => file.type.includes("image") || file.type.includes("pdf"));

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
    const target = event.target as HTMLElement;

    const eventKey = event.key.toLowerCase();
    const metaKey = event.metaKey || event.ctrlKey;

    const isEditMessage = getIsEditMessage();
    const { status, threadId } = getStatusAndThreadId();

    const shouldFocusTextarea =
      target.tagName !== "TEXTAREA" && target.tagName !== "INPUT" && !target.isContentEditable;

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
        const selectedTextContext = getSelectionActionState();
        const input = useChatStore.getState().input;
        const inputWithSelectedContext = selectedTextContext
          ? appendSelectedTextBlockquote(input, selectedTextContext.text)
          : input;

        chatStoreActions.setInput(`${inputWithSelectedContext}${event.key}`);
        if (selectedTextContext) {
          chatStoreActions.setSelectedBlockquoteContext({ text: selectedTextContext.text });
          setSelectionAction(null);
          window.getSelection()?.removeAllRanges();
        }
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
        const textareaId = isEditMessage ? "textarea-user-message-edit" : "textarea-chat-input";
        focusTextareaByIdAtEnd(textareaId);
      }

      return;
    }

    if (eventKey === NEW_THREAD_KEYBOARD_SHORTCUT && event.shiftKey && metaKey) {
      event.preventDefault();
      await queryClient.ensureQueryData(convexQuery(api.functions.users.getCurrentUserPreferences));

      await navigate({ to: "/" });
      return;
    }
  });

  // Scroll to bottom only if the user is currently "sticky" (already at the bottom).
  useWindowEvent(
    "chat:scroll-if-sticky",
    function handleScrollIfSticky() {
      const element = getMessagesScrollAreaElement();
      if (!element) return;

      scrollToBottomIfStickyRaf(element, "auto");
    },
    { capture: true },
  );

  // Scroll to bottom regardless of current scroll position (explicit user intent).
  useWindowEvent(
    "chat:force-scroll-bottom",
    function handleForceScrollBottom() {
      const element = getMessagesScrollAreaElement();
      if (!element) return;

      setStickyToBottom(true);

      requestAnimationFrame(() => {
        scrollToBottom(element, "auto");

        requestAnimationFrame(() => {
          scrollToBottom(element, "auto");
        });
      });
    },
    { capture: true },
  );

  return (
    <>
      {selectionAction ? (
        <ButtonWithTip
          variant="outline"
          size="sm"
          side="top"
          title="Add selected text to chat"
          className="fixed z-50 h-7 gap-1.5 rounded-md border border-border bg-popover px-2 text-xs text-popover-foreground opacity-100 shadow-md hover:bg-muted dark:bg-input dark:hover:bg-input/80"
          style={{
            left: selectionAction.left,
            top: selectionAction.top,
            transform: "translateX(-50%)",
          }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleAddSelectedTextContext}
        >
          <MessageSquarePlusIcon className="size-3.5" />
          Add to chat
        </ButtonWithTip>
      ) : null}
    </>
  );
}
