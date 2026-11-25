import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import type { Token } from "@ui-sdk/react/token-input";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  EDIT_COMPOSER_ID,
  FILE_TOKEN_TYPE,
  insertUploadChips,
  MAIN_COMPOSER_ID,
  removeComposerChips,
  UPLOAD_TOKEN_TYPE,
} from "../chat/composer-tokens";
import { tryGetModelData } from "../chat/models";
import type { ReasoningEffort, RemoveAllExceptFunctions, UserAttachment } from "../types";

type EditMessage = {
  _id: Id<"messages">;
  input: string;

  model: string;
  currentAttachments: Doc<"attachments">[];
  keptAttachmentIds: Array<Id<"attachments">>;
  attachments: UserAttachment[];
  modelParams: { effort?: ReasoningEffort; webSearch?: boolean };
};

export type ChatStore = {
  input: string;
  setInput: (content: string) => void;

  editMessage: EditMessage | null;
  setEditMessage: (message: EditMessage | null) => void;
  updateEditMessage: (message: Partial<EditMessage>) => void;
  addEditAttachments: (attachments: UserAttachment[]) => void;
  removeEditAttachment: (id: string) => void;
  removeEditExistingAttachment: (id: Id<"attachments">) => void;
  /** Takes the files of chips removed from the edit box out of the edit's tray. */
  removeEditChipAttachments: (chips: ReadonlyArray<Token>) => void;

  attachments: UserAttachment[];
  addAttachments: (attachments: UserAttachment[]) => void;
  removeAttachment: (id: string) => void;
  /** Takes the files of chips removed from the composer out of the tray. */
  removeChipAttachments: (chips: ReadonlyArray<Token>) => void;
  clearAttachments: () => void;
  retainCompatibleAttachments: (modelId: string) => void;
  retainCompatibleEditAttachments: (modelId: string) => void;

  resetInput: () => void;

  textareaHeight: number;
  setTextareaHeight: (height: number) => void;

  isDragOver: boolean;
  setIsDragOver: (isDragOver: boolean) => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      input: "",
      setInput: (content) => set({ input: content }),

      editMessage: null,
      setEditMessage: (message) => set({ editMessage: message }),
      updateEditMessage: (message) => {
        const { editMessage } = get();
        if (!editMessage) return;

        set({ editMessage: { ...editMessage, ...message } });
      },
      addEditAttachments: (attachments) => {
        const { editMessage } = get();
        if (!editMessage) return;

        const added = withoutKnown(editMessage.attachments, attachments);
        set({ editMessage: { ...editMessage, attachments: [...editMessage.attachments, ...added] } });
        insertUploadChips(EDIT_COMPOSER_ID, added);
      },
      removeEditAttachment: (id) => {
        const { editMessage } = get();
        if (!editMessage) return;

        set({
          editMessage: {
            ...editMessage,
            attachments: editMessage.attachments.filter((a) => a.id !== id),
          },
        });
        removeComposerChips(EDIT_COMPOSER_ID, UPLOAD_TOKEN_TYPE, [id]);
      },
      removeEditExistingAttachment: (id) => {
        const { editMessage } = get();
        if (!editMessage) return;

        set({
          editMessage: {
            ...editMessage,
            keptAttachmentIds: editMessage.keptAttachmentIds.filter((a) => a !== id),
          },
        });
        removeComposerChips(EDIT_COMPOSER_ID, FILE_TOKEN_TYPE, [id]);
      },

      removeEditChipAttachments: (chips) => {
        const { editMessage, removeEditAttachment, removeEditExistingAttachment } = get();
        if (!editMessage) return;

        for (const chip of chips) {
          if (chip.type === UPLOAD_TOKEN_TYPE) removeEditAttachment(chip.value);

          const kept = editMessage.keptAttachmentIds.find((id) => id === chip.value);
          if (chip.type === FILE_TOKEN_TYPE && kept) removeEditExistingAttachment(kept);
        }
      },

      attachments: [],
      addAttachments: (attachments) => {
        const added = withoutKnown(get().attachments, attachments);
        set((state) => ({ attachments: [...state.attachments, ...added] }));
        insertUploadChips(MAIN_COMPOSER_ID, added);
      },
      removeAttachment: (id) => {
        set((state) => ({ attachments: state.attachments.filter((a) => a.id !== id) }));
        removeComposerChips(MAIN_COMPOSER_ID, UPLOAD_TOKEN_TYPE, [id]);
      },
      removeChipAttachments: (chips) => {
        for (const chip of chips) {
          if (chip.type === UPLOAD_TOKEN_TYPE) get().removeAttachment(chip.value);
        }
      },
      clearAttachments: () => set({ attachments: [] }),
      retainCompatibleAttachments: (modelId) => {
        const model = tryGetModelData(modelId);
        const { attachments } = get();
        const kept = model
          ? attachments.filter((attachment) => model.modalities.input.includes(attachment.type))
          : [];
        if (kept.length === attachments.length) return;

        set({ attachments: kept });
        removeComposerChips(MAIN_COMPOSER_ID, UPLOAD_TOKEN_TYPE, droppedIds(attachments, kept));
      },
      retainCompatibleEditAttachments: (modelId) => {
        const editMessage = get().editMessage;
        if (!editMessage) return;

        const model = tryGetModelData(modelId);
        const attachments = model
          ? editMessage.attachments.filter((attachment) => model.modalities.input.includes(attachment.type))
          : [];
        const keptAttachmentIds = model
          ? editMessage.keptAttachmentIds.filter((attachmentId) => {
              const attachment = editMessage.currentAttachments.find(
                (candidate) => candidate._id === attachmentId,
              );
              return attachment ? model.modalities.input.includes(attachment.type) : false;
            })
          : [];

        set({ editMessage: { ...editMessage, attachments, keptAttachmentIds } });
        removeComposerChips(
          EDIT_COMPOSER_ID,
          UPLOAD_TOKEN_TYPE,
          droppedIds(editMessage.attachments, attachments),
        );
        removeComposerChips(
          EDIT_COMPOSER_ID,
          FILE_TOKEN_TYPE,
          editMessage.keptAttachmentIds.filter((id) => !keptAttachmentIds.includes(id)),
        );
      },

      resetInput: () => set({ input: "", attachments: [] }),

      // Default: 147px + 8px (positon bottom) + 16px (padding above)
      textareaHeight: 147 + 8 + 16,
      setTextareaHeight: (height) => set({ textareaHeight: Math.max(height, 147) + 8 + 16 }),

      isDragOver: false,
      setIsDragOver: (isDragOver) => set({ isDragOver }),
    }),
    {
      name: "local-chat-store",
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({ input: state.input }),
    },
  ),
);

/** The files in `incoming` that aren't in `current` yet. */
function withoutKnown(current: ReadonlyArray<UserAttachment>, incoming: ReadonlyArray<UserAttachment>) {
  const ids = new Set(current.map((attachment) => attachment.id));
  return incoming.filter((attachment) => {
    if (ids.has(attachment.id)) return false;
    ids.add(attachment.id);
    return true;
  });
}

function droppedIds(before: ReadonlyArray<UserAttachment>, after: ReadonlyArray<UserAttachment>): string[] {
  const kept = new Set(after.map((attachment) => attachment.id));
  return before.flatMap((attachment) => (kept.has(attachment.id) ? [] : [attachment.id]));
}

export const chatStoreActions: RemoveAllExceptFunctions<ChatStore> = useChatStore.getInitialState();
