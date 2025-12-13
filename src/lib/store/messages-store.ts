import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";

import type { ChatMessage, RemoveAllExceptFunctions } from "../types";

export type MessagesStore = {
  currentThreadId: Id<"threads"> | null;
  getCurrentThreadId: () => Id<"threads"> | null;
  setCurrentThreadId: (threadId: Id<"threads"> | null) => void;

  messages: ChatMessage[];
  messagesIds: Id<"messages">[];
  messagesById: Record<Id<"messages">, ChatMessage>;

  getMessages: () => ChatMessage[];
  syncMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;

  updateMessageById: (messageId: Id<"messages">, updates: Partial<ChatMessage>) => void;

  controllers: Map<Id<"threads">, AbortController>;
  setController: (assistantMessageId: Id<"threads">, controller: AbortController) => void;
  removeController: (assistantMessageId: Id<"threads">) => void;
  getController: (assistantMessageId: Id<"threads">) => AbortController | undefined;
};

export const useMessageStore = create<MessagesStore>((set, get) => ({
  currentThreadId: null,
  getCurrentThreadId: () => get().currentThreadId,
  setCurrentThreadId: (threadId) => set({ currentThreadId: threadId }),

  messages: [],
  messagesIds: [],
  messagesById: {},

  getMessages: () => get().messages,

  clearMessages: () => set({ messages: [], messagesIds: [] }),
  syncMessages: (messages) => {
    const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);

    return set({
      messages: sorted,
      messagesIds: sorted.map((m) => m._id),
      messagesById: sorted.reduce((acc, m) => ({ ...acc, [m._id]: m }), {}),
    });
  },

  updateMessageById: (messageId, updates) => {
    const messages = get().messages.map((m) => (m._id === messageId ? { ...m, ...updates } : m));
    get().syncMessages(messages);
  },

  controllers: new Map(),
  setController: (assistantMessageId, controller) =>
    set((state) => {
      state.controllers.set(assistantMessageId, controller);
      return { controllers: new Map(state.controllers) };
    }),
  removeController: (assistantMessageId) =>
    set((state) => {
      state.controllers.delete(assistantMessageId);
      return { controllers: new Map(state.controllers) };
    }),
  getController: (assistantMessageId) => {
    return get().controllers.get(assistantMessageId);
  },
}));

export const messageStoreActions =
  useMessageStore.getInitialState() as RemoveAllExceptFunctions<MessagesStore>;
