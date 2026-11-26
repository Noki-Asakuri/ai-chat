import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import type { Token } from "@ui-sdk/react/token-input";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  EDIT_COMPOSER_ID,
  FILE_TOKEN_TYPE,
  hasComposerChip,
  insertUploadChips,
  MAIN_COMPOSER_ID,
  removeComposerChips,
  UPLOAD_TOKEN_TYPE,
} from "../chat/composer-tokens";
import { tryGetModelData } from "../chat/models";
import type { ReasoningEffort, RemoveAllExceptFunctions, UserAttachment } from "../types";

export type EditMessage = {
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
  /** Puts back files the user removed from the edit's tray whose chips are among `chips` again. */
  restoreEditChipAttachments: (chips: ReadonlyArray<Token>) => void;

  attachments: UserAttachment[];
  addAttachments: (attachments: UserAttachment[]) => void;
  removeAttachment: (id: string) => void;
  /** Takes the files of chips removed from the composer out of the tray. */
  removeChipAttachments: (chips: ReadonlyArray<Token>) => void;
  /** Puts back files the user removed from the tray whose chips are among `chips` again. */
  restoreChipAttachments: (chips: ReadonlyArray<Token>) => void;
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
      setEditMessage: (message) => {
        removedEditUploads.clear();
        removedEditFileIds.clear();
        set({ editMessage: message });
      },
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

        const removed = editMessage.attachments.find((attachment) => attachment.id === id);
        if (removed) removedEditUploads.set(id, removed);
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

        if (editMessage.keptAttachmentIds.includes(id)) removedEditFileIds.add(id);
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
          // The file stays while another chip of it, such as a pasted copy, is still in the composer.
          if (hasComposerChip(EDIT_COMPOSER_ID, chip.type, chip.value)) continue;
          if (chip.type === UPLOAD_TOKEN_TYPE) removeEditAttachment(chip.value);

          const kept = editMessage.keptAttachmentIds.find((id) => id === chip.value);
          if (chip.type === FILE_TOKEN_TYPE && kept) removeEditExistingAttachment(kept);
        }
      },
      restoreEditChipAttachments: (chips) => {
        const { editMessage } = get();
        if (!editMessage) return;

        const uploads = restorable(chips, UPLOAD_TOKEN_TYPE, removedEditUploads);
        const ownFileIds = editMessage.currentAttachments.flatMap((attachment) =>
          removedEditFileIds.has(attachment._id) &&
          chips.some((chip) => chip.type === FILE_TOKEN_TYPE && chip.value === attachment._id)
            ? [attachment._id]
            : [],
        );
        if (uploads.length === 0 && ownFileIds.length === 0) return;

        for (const id of ownFileIds) removedEditFileIds.delete(id);
        set({
          editMessage: {
            ...editMessage,
            attachments: [...editMessage.attachments, ...withoutKnown(editMessage.attachments, uploads)],
            keptAttachmentIds: [...new Set([...editMessage.keptAttachmentIds, ...ownFileIds])],
          },
        });
      },

      attachments: [],
      addAttachments: (attachments) => {
        const added = withoutKnown(get().attachments, attachments);
        set((state) => ({ attachments: [...state.attachments, ...added] }));
        insertUploadChips(MAIN_COMPOSER_ID, added);
      },
      removeAttachment: (id) => {
        const removed = get().attachments.find((attachment) => attachment.id === id);
        if (removed) removedUploads.set(id, removed);
        set((state) => ({ attachments: state.attachments.filter((a) => a.id !== id) }));
        removeComposerChips(MAIN_COMPOSER_ID, UPLOAD_TOKEN_TYPE, [id]);
      },
      removeChipAttachments: (chips) => {
        for (const chip of chips) {
          // The file stays while another chip of it, such as a pasted copy, is still in the composer.
          if (chip.type !== UPLOAD_TOKEN_TYPE || hasComposerChip(MAIN_COMPOSER_ID, chip.type, chip.value))
            continue;
          get().removeAttachment(chip.value);
        }
      },
      restoreChipAttachments: (chips) => {
        const uploads = restorable(chips, UPLOAD_TOKEN_TYPE, removedUploads);
        if (uploads.length === 0) return;

        set((state) => ({
          attachments: [...state.attachments, ...withoutKnown(state.attachments, uploads)],
        }));
      },
      clearAttachments: () => {
        removedUploads.clear();
        set({ attachments: [] });
      },
      retainCompatibleAttachments: (modelId) => {
        // Files removed before a model switch might not suit the new model, so undo can't bring them back.
        removedUploads.clear();
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

        removedEditUploads.clear();
        removedEditFileIds.clear();
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

      resetInput: () => {
        removedUploads.clear();
        set({ input: "", attachments: [] });
      },

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

// Files the user removed, by local id, and own files they took out of an edit. Undo or redo can
// bring their chips back, and then the files come back too. They're forgotten on send and on a model
// switch, and files dropped for not suiting the model are never kept, so those chips come back as names.
const removedUploads = new Map<string, UserAttachment>();
const removedEditUploads = new Map<string, UserAttachment>();
const removedEditFileIds = new Set<string>();

/** The removed files that have a chip of this type among `chips`; each is forgotten once returned. */
function restorable(
  chips: ReadonlyArray<Token>,
  type: string,
  removed: Map<string, UserAttachment>,
): UserAttachment[] {
  return chips.flatMap((chip) => {
    const attachment = chip.type === type ? removed.get(chip.value) : undefined;
    if (!attachment) return [];

    removed.delete(chip.value);
    return [attachment];
  });
}

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
