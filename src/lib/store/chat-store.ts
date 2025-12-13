import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { RemoveAllExceptFunctions, UserAttachment } from "../types";

export type ChatStore = {
  input: string;
  setInput: (content: string) => void;

  attachments: UserAttachment[];
  addAttachments: (attachments: UserAttachment[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  resetInput: () => void;

  textareaHeight: number;
  setTextareaHeight: (height: number) => void;

  lastUserMessageHeight?: number | null;
  setMessageHeight: (height?: number | null) => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      input: "",
      setInput: (content) => set({ input: content }),

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
