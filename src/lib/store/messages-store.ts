import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { ChatMessage, RemoveAllExceptFunctions } from "../types";

type LocalMessageMeta = {
  localRevision: number;
  localUpdatedAt: number;
};

type ThreadMessagesState = {
  messageIds: Array<Id<"messages">>;
  messagesById: Record<Id<"messages">, ChatMessage>;
  localMetaById: Record<Id<"messages">, LocalMessageMeta>;

  /**
   * Monotonic token used to ignore out-of-order sync attempts for the same thread.
   * The caller should pass an incrementing value per-thread.
   */
  latestAppliedSyncToken: number;
};

export type MessagesStore = {
  currentThreadId: Id<"threads"> | null;
  setCurrentThreadId: (threadId: Id<"threads"> | null) => void;

  /**
   * View state for the currently selected thread (backwards-compatible with existing UI).
   * The real source of truth lives under `threadsById`.
   */
  messageIds: Array<Id<"messages">>;
  messagesById: Record<Id<"messages">, ChatMessage>;

  threadsById: Record<Id<"threads">, ThreadMessagesState>;

  /**
   * Merge server snapshot into the per-thread cache.
   * Must not downgrade local streaming progress with an older server snapshot.
   */
  syncMessages: (threadId: Id<"threads">, messages: ChatMessage[], syncToken?: number) => void;

  /**
   * Clears only the current view (does not delete cached per-thread data).
   */
  clearMessages: () => void;

  /**
   * Applies streaming deltas to a specific message in a specific thread.
   * Updates are applied even if the thread isn't currently visible.
   */
  setMessageParts: (
    threadId: Id<"threads">,
    id: Id<"messages">,
    parts: ChatMessage["parts"],
    metadata?: ChatMessage["metadata"],
  ) => void;

  controllers: Record<Id<"threads">, AbortController>;
  setController: (threadId: Id<"threads">, controller: AbortController) => void;
  removeController: (threadId: Id<"threads">) => void;
};

export const useMessageStore = create<MessagesStore>()(
  immer((set) => {
    function ensureThreadStateInDraft(
      state: MessagesStore,
      threadId: Id<"threads">,
    ): ThreadMessagesState {
      const existing = state.threadsById[threadId];
      if (existing) return existing;

      const created: ThreadMessagesState = {
        messageIds: [],
        messagesById: {},
        localMetaById: {},
        latestAppliedSyncToken: 0,
      };

      state.threadsById[threadId] = created;
      return created;
    }

    function updateCurrentViewFromThread(
      state: MessagesStore,
      threadId: Id<"threads"> | null,
    ): void {
      if (!threadId) {
        state.messageIds = [];
        state.messagesById = {};
        return;
      }

      const thread = state.threadsById[threadId];
      if (!thread) {
        state.messageIds = [];
        state.messagesById = {};
        return;
      }

      state.messageIds = thread.messageIds;
      state.messagesById = thread.messagesById;
    }

    function mergeServerMessage(
      existing: ChatMessage,
      incoming: ChatMessage,
      localMeta: LocalMessageMeta | undefined,
    ): ChatMessage {
      const localComparableTime = Math.max(existing.updatedAt, localMeta?.localUpdatedAt ?? 0);
      const localHasStreamProgress = (localMeta?.localRevision ?? 0) > 0;

      if (localHasStreamProgress && incoming.updatedAt < localComparableTime) {
        // Server snapshot is behind what the client has already accumulated from streaming.
        // Keep local streaming-sensitive fields while still allowing server to fill in other fields.
        return {
          ...incoming,
          parts: existing.parts,
          status: existing.status,
          metadata: existing.metadata,
          error: incoming.error ?? existing.error,
          resumableStreamId: incoming.resumableStreamId ?? existing.resumableStreamId,
          attachments: incoming.attachments.length ? incoming.attachments : existing.attachments,
        };
      }

      return incoming;
    }

    return {
      currentThreadId: null,
      setCurrentThreadId: function setCurrentThreadId(threadId) {
        set(function setCurrent(state) {
          state.currentThreadId = threadId;
          updateCurrentViewFromThread(state, threadId);
        });
      },

      messageIds: [],
      messagesById: {},

      threadsById: {},

      clearMessages: function clearMessages() {
        // Clear only the view state (keep per-thread cache so navigation won't regress streaming state).
        set(function clear(state) {
          state.messageIds = [];
          state.messagesById = {};
        });
      },

      syncMessages: function syncMessages(threadId, messages, syncToken) {
        set(function sync(state) {
          const thread = ensureThreadStateInDraft(state, threadId);

          if (syncToken !== undefined && syncToken < thread.latestAppliedSyncToken) {
            return;
          }
          if (syncToken !== undefined) {
            thread.latestAppliedSyncToken = syncToken;
          }

          const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);

          for (const msg of sorted) {
            const existing = thread.messagesById[msg._id];
            if (!existing) {
              thread.messagesById[msg._id] = msg;
              continue;
            }

            const localMeta = thread.localMetaById[msg._id];
            thread.messagesById[msg._id] = mergeServerMessage(existing, msg, localMeta);
          }

          // Recompute ordering from the merged cache so older snapshots can't drop locally-known messages.
          const allMessages: Array<ChatMessage> = Object.values(thread.messagesById);
          allMessages.sort((a, b) => a.createdAt - b.createdAt || a.updatedAt - b.updatedAt);

          const nextIds: Array<Id<"messages">> = [];
          for (const m of allMessages) {
            nextIds.push(m._id);
          }

          thread.messageIds = nextIds;

          if (state.currentThreadId === threadId) {
            updateCurrentViewFromThread(state, threadId);
          }
        });
      },

      setMessageParts: function setMessageParts(threadId, id, parts, metadata) {
        set(function update(state) {
          const thread = ensureThreadStateInDraft(state, threadId);
          const msg = thread.messagesById[id];
          if (!msg) return;

          msg.parts = parts;
          if (metadata) msg.metadata = metadata;

          const prev = thread.localMetaById[id];
          const nextRevision = (prev?.localRevision ?? 0) + 1;

          thread.localMetaById[id] = {
            localRevision: nextRevision,
            localUpdatedAt: Date.now(),
          };

          if (state.currentThreadId === threadId) {
            updateCurrentViewFromThread(state, threadId);
          }
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
