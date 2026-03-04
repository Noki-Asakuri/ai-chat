import type { Doc, Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

  attachments: UserAttachment[];
  addAttachments: (attachments: UserAttachment[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  resetInput: () => void;

  textareaHeight: number;
  setTextareaHeight: (height: number) => void;

  lastUserMessageHeight?: number | null;
  setMessageHeight: (height?: number | null) => void;

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

        const next: Array<UserAttachment> = [...editMessage.attachments];
        for (const attachment of attachments) {
          const exists = next.some((a) => a.id === attachment.id);
          if (exists) continue;
          next.push(attachment);
        }

        set({ editMessage: { ...editMessage, attachments: next } });
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
      },

      attachments: [],
      addAttachments: (attachments) =>
        set((state) => ({ attachments: [...state.attachments, ...attachments] })),
      removeAttachment: (id) =>
        set((state) => ({ attachments: state.attachments.filter((a) => a.id !== id) })),
      clearAttachments: () => set({ attachments: [] }),

      resetInput: () => set({ input: "", attachments: [] }),

      // Default: 147px + 8px (positon bottom) + 16px (padding above)
      textareaHeight: 147 + 8 + 16,
      setTextareaHeight: (height) => set({ textareaHeight: Math.max(height, 147) + 8 + 16 }),

      lastUserMessageHeight: null,
      setMessageHeight: (height) => set({ lastUserMessageHeight: height }),

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

export const chatStoreActions =
  useChatStore.getInitialState() as RemoveAllExceptFunctions<ChatStore>;
