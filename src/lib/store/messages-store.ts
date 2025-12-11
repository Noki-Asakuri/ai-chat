import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";

import type { ChatMessage } from "../types";

export type MessagesStore = {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;

  controllers: Map<Id<"threads">, AbortController>;
  setController: (assistantMessageId: Id<"threads">, controller: AbortController) => void;
  clearController: (assistantMessageId: Id<"threads">) => void;
  getController: (assistantMessageId: Id<"threads">) => AbortController | undefined;
};

export function createMessagesStore(initialMessages: ChatMessage[]) {
  return create<MessagesStore>((set, get) => ({
    messages: initialMessages ?? [],
    setMessages: (messages) => set({ messages }),

    controllers: new Map(),
    setController: (assistantMessageId, controller) =>
      set((state) => {
        state.controllers.set(assistantMessageId, controller);
        return { controllers: new Map(state.controllers) };
      }),
    clearController: (assistantMessageId) =>
      set((state) => {
        state.controllers.delete(assistantMessageId);
        return { controllers: new Map(state.controllers) };
      }),
    getController: (assistantMessageId) => {
      return get().controllers.get(assistantMessageId);
    },
  }));
}
