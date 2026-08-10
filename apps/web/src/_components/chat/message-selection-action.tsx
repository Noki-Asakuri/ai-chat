import { MessageSquarePlusIcon } from "lucide-react";
import { useState } from "react";

import { ButtonWithTip } from "../ui/button";

import { focusTextareaByIdAtEnd } from "@/lib/chat/focus-textarea";
import { MESSAGE_SELECTION_EVENT, type MessageSelection } from "@/lib/chat/message-selection";
import { useWindowEvent } from "@/lib/hooks/use-window-event";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

const MAX_SELECTED_CONTEXT_LENGTH = 4000;
const ACTION_WIDTH_PX = 132;
const ACTION_HEIGHT_PX = 28;
const ACTION_GAP_PX = 8;
const ACTION_VERTICAL_GAP_PX = 12;

function getSelectedContext(text: string): string {
  return text.length > MAX_SELECTED_CONTEXT_LENGTH
    ? `${text.slice(0, MAX_SELECTED_CONTEXT_LENGTH).trimEnd()}...`
    : text;
}

function appendBlockquote(input: string, text: string): string {
  const blockquote = text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");

  if (!input.trim()) return `${blockquote}\n\n`;
  return `${input.trimEnd()}\n\n${blockquote}\n\n`;
}

export function MessageSelectionAction() {
  const [selection, setSelection] = useState<MessageSelection | null>(null);

  useWindowEvent<CustomEvent<MessageSelection | null>>(
    MESSAGE_SELECTION_EVENT,
    function handleMessageSelection(event) {
      if (useChatStore.getState().editMessage) {
        setSelection(null);
        return;
      }

      setSelection(event.detail);
    },
  );
  useWindowEvent("mousedown", () => setSelection(null));
  useWindowEvent("scroll", () => setSelection(null), { capture: true });

  if (!selection) return null;

  const text = getSelectedContext(selection.text);
  const left = Math.min(
    Math.max(selection.x, ACTION_WIDTH_PX / 2 + ACTION_GAP_PX),
    window.innerWidth - ACTION_WIDTH_PX / 2 - ACTION_GAP_PX,
  );
  const top = Math.min(
    selection.y + ACTION_VERTICAL_GAP_PX,
    window.innerHeight - ACTION_HEIGHT_PX - ACTION_GAP_PX,
  );

  function handleAddToChat() {
    const input = useChatStore.getState().input;
    chatStoreActions.setInput(appendBlockquote(input, text));
    chatStoreActions.setSelectedBlockquoteContext({ text });

    setSelection(null);
    window.getSelection()?.removeAllRanges();
    focusTextareaByIdAtEnd("textarea-chat-input");
  }

  return (
    <ButtonWithTip
      variant="outline"
      size="sm"
      side="top"
      title="Add selected text to chat"
      className="fixed z-50 h-7 gap-1.5 rounded-md border border-border bg-popover px-2 text-xs text-popover-foreground opacity-100 shadow-md hover:bg-muted dark:bg-popover dark:hover:bg-muted"
      style={{ left, top, transform: "translateX(-50%)" }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={handleAddToChat}
    >
      <MessageSquarePlusIcon className="size-3.5" />
      Add to chat
    </ButtonWithTip>
  );
}
