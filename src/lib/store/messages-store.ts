import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { ChatMessage, RemoveAllExceptFunctions } from "../types";

export type MessagesStore = {
  currentThreadId: Id<"threads"> | null;
  setCurrentThreadId: (threadId: Id<"threads"> | null) => void;

  messageIds: Id<"messages">[];
  messagesById: Record<Id<"messages">, ChatMessage>;

  syncMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;

  setMessageParts: (
    id: Id<"messages">,
    parts: ChatMessage["parts"],
    metadata?: ChatMessage["metadata"],
  ) => void;

  controllers: Record<Id<"threads">, AbortController>;
  setController: (assistantMessageId: Id<"threads">, controller: AbortController) => void;
  removeController: (assistantMessageId: Id<"threads">) => void;
};

export const useMessageStore = create<MessagesStore>()(
  immer((set) => {
    return {
      currentThreadId: null,
      setCurrentThreadId: (threadId) => set({ currentThreadId: threadId }),

      messageIds: [],
      messagesById: {},

      clearMessages: function clearMessages() {
        set(function clear(state) {
          state.messageIds = [];
          state.messagesById = {};
        });
      },
      syncMessages: function syncMessages(messages) {
        set(function sync(state) {
          const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);

          state.messageIds = sorted.map((m) => m._id);
          state.messagesById = sorted.reduce((acc, m) => ({ ...acc, [m._id]: m }), {});
        });
      },

      setMessageParts(id, parts, metadata) {
        set(function update(state) {
          const msg = state.messagesById[id];
          if (!msg) return;

          msg.parts = parts;
          if (metadata) msg.metadata = metadata;
        });
      },

      controllers: {},
      setController: function setController(assistantMessageId, controller) {
        set(function set(state) {
          state.controllers[assistantMessageId] = controller;
        });
      },
      removeController: function removeController(assistantMessageId) {
        set(function remove(state) {
          delete state.controllers[assistantMessageId];
        });
      },
    };
  }),
);

export const messageStoreActions =
  useMessageStore.getInitialState() as RemoveAllExceptFunctions<MessagesStore>;
