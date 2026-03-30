import { useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { ChatEditActionButtons } from "./action-buttons";
import { ChatEditAttachmentsDisplay } from "./chat-edit-attachments-display";
import { BaseInputTextArea } from "./main-textarea";
import { ChatEditSendButton } from "./send-button";
import { useChatEditSave } from "./use-chat-edit-save";

import {
  getMessagesScrollAreaElement,
  setStickyToBottom,
  updateStickyToBottomFromScroll,
} from "@/lib/chat/scroll-stickiness";
import { focusTextareaByIdAtEnd } from "@/lib/chat/focus-textarea";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

const EDITOR_VIEWPORT_MARGIN_PX = 16;

function syncEditorIntoView(editorElement: HTMLDivElement): void {
  const scrollArea = getMessagesScrollAreaElement();
  if (!scrollArea) return;

  const editorRect = editorElement.getBoundingClientRect();
  const scrollAreaRect = scrollArea.getBoundingClientRect();

  const visibleTop = scrollAreaRect.top + EDITOR_VIEWPORT_MARGIN_PX;
  const visibleBottom = scrollAreaRect.bottom - EDITOR_VIEWPORT_MARGIN_PX;
  const visibleHeight = Math.max(visibleBottom - visibleTop, 0);
  const editorHeight = editorRect.height;

  let scrollDelta = 0;

  if (editorHeight > visibleHeight) {
    const editorTopOffset = editorRect.top - visibleTop;
    if (editorTopOffset !== 0) {
      scrollDelta = editorTopOffset;
    }
  } else if (editorRect.top < visibleTop) {
    scrollDelta = editorRect.top - visibleTop;
  } else if (editorRect.bottom > visibleBottom) {
    scrollDelta = editorRect.bottom - visibleBottom;
  }

  if (scrollDelta !== 0) {
    scrollArea.scrollTop += scrollDelta;
    setStickyToBottom(false);
  } else {
    updateStickyToBottomFromScroll(scrollArea);
  }
}

export function ChatEditTextarea() {
  const editorRef = useRef<HTMLDivElement>(null);
  const editMessage = useChatStore((state) => state.editMessage);
  const editMessageId = editMessage?._id ?? null;
  const { isSaving, saveEdits } = useChatEditSave();

  useLayoutEffect(() => {
    if (!editMessageId) return;

    focusTextareaByIdAtEnd("textarea-user-message-edit");

    let firstRafId = 0;
    let secondRafId = 0;

    function revealEditor(): void {
      const editorElement = editorRef.current;
      if (!editorElement) return;

      syncEditorIntoView(editorElement);
    }

    firstRafId = requestAnimationFrame(() => {
      revealEditor();

      secondRafId = requestAnimationFrame(() => {
        revealEditor();
      });
    });

    return () => {
      if (firstRafId !== 0) {
        cancelAnimationFrame(firstRafId);
      }

      if (secondRafId !== 0) {
        cancelAnimationFrame(secondRafId);
      }
    };
  }, [editMessageId]);

  if (!editMessage) return null;

  function handleAddAttachments({ files }: { files: File[] }) {
    const acceptFiles = files.filter(
      (file) => file.type.includes("image") || file.type.includes("pdf"),
    );

    if (acceptFiles.length > 0) {
      const attachments = acceptFiles.map((file) => ({
        id: uuidv4(),
        file,
        type: (file.type.includes("image") ? "image" : "pdf") as "image" | "pdf",
      }));

      chatStoreActions.addEditAttachments(attachments);
    }

    if (acceptFiles.length < files.length) {
      toast.error("File type not supported", {
        description: "Please upload an image or PDF file.",
      });
    }
  }

  return (
    <div ref={editorRef} data-slot="chat-textarea" className="pointer-events-none">
      <form className="mx-auto space-y-2">
        <div className="pointer-events-auto relative mx-auto max-w-4xl space-y-2 rounded-md border bg-background/80 backdrop-blur-md backdrop-saturate-150">
          <ChatEditAttachmentsDisplay />

          <div>
            <BaseInputTextArea
              id="textarea-user-message-edit"
              input={editMessage.input}
              setInput={(input) => chatStoreActions.updateEditMessage({ input })}
              handleAddAttachments={handleAddAttachments}
              onConfirm={saveEdits}
              disabled={isSaving}
            />

            <div className="flex items-end justify-between border-t px-2.5 py-2">
              <ChatEditActionButtons />
              <ChatEditSendButton isSaving={isSaving} onSave={saveEdits} />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
