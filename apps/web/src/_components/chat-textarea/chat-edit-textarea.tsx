import { useEffectEvent, useLayoutEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";

import { ChatEditActionButtons } from "./action-buttons";
import { ChatEditAttachmentsDisplay } from "./chat-edit-attachments-display";
import { RichComposer } from "./rich-composer";
import { ChatEditSendButton } from "./send-button";
import { useChatEditSave } from "./use-chat-edit-save";

import {
  getMessagesScrollAreaElement,
  setStickyToBottom,
  updateStickyToBottomFromScroll,
} from "@/lib/chat/scroll-stickiness";
import { focusTextareaByIdAtEnd } from "@/lib/chat/focus-textarea";
import { getAttachmentRejectionMessage, prepareAttachmentsForModel } from "@/lib/chat/attachments";
import { EDIT_COMPOSER_ID } from "@/lib/chat/composer-tokens";
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

type EditState = NonNullable<ReturnType<typeof useChatStore.getState>["editMessage"]>;

/** One of the message's own files is attached only while it is kept in the tray. */
function isEditFileAttached(editMessage: EditState, attachmentId: string): boolean {
  const isOwnFile = editMessage.currentAttachments.some((attachment) => attachment._id === attachmentId);
  return !isOwnFile || editMessage.keptAttachmentIds.some((id) => id === attachmentId);
}

export function ChatEditTextarea() {
  const editorRef = useRef<HTMLDivElement>(null);
  const editMessage = useChatStore((state) => state.editMessage);
  const editMessageId = editMessage?._id ?? null;
  const { isSaving, saveEdits } = useChatEditSave();

  const handleAddAttachments = useEffectEvent(({ files }: { files: File[] }) => {
    const currentEditMessage = useChatStore.getState().editMessage;
    if (!currentEditMessage) return;

    const { attachments, rejectedCount } = prepareAttachmentsForModel(files, currentEditMessage.model);

    if (attachments.length > 0) {
      chatStoreActions.addEditAttachments(attachments);
    }

    if (rejectedCount > 0) {
      toast.error("File type not supported", {
        description: getAttachmentRejectionMessage(currentEditMessage.model),
      });
    }
  });

  useLayoutEffect(() => {
    if (!editMessageId) return undefined;

    focusTextareaByIdAtEnd(EDIT_COMPOSER_ID);

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

  return (
    <div ref={editorRef} data-slot="chat-textarea" className="pointer-events-none">
      <form className="mx-auto space-y-2">
        <div className="surface-edge pointer-events-auto relative mx-auto max-w-4xl space-y-2 rounded-md border bg-background/80 backdrop-blur-md backdrop-saturate-150">
          <ChatEditAttachmentsDisplay />

          <div>
            <RichComposer
              id={EDIT_COMPOSER_ID}
              input={editMessage.input}
              setInput={(input) => chatStoreActions.updateEditMessage({ input })}
              model={editMessage.model}
              uploads={editMessage.attachments}
              onRemoveChips={chatStoreActions.removeEditChipAttachments}
              isFileAttached={(attachmentId) => isEditFileAttached(editMessage, attachmentId)}
              handleAddAttachments={handleAddAttachments}
              onConfirm={saveEdits}
              disabled={isSaving}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-2.5 py-2">
              <ChatEditActionButtons />
              <ChatEditSendButton isSaving={isSaving} onSave={saveEdits} />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
