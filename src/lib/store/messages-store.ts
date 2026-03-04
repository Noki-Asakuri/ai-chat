import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { ChatMessage, RemoveAllExceptFunctions } from "../types";

type LocalMessageMeta = {
  localRevision: number;
  localUpdatedAt: number;
};

type VariantMessageIdsByUserMessageId = Record<Id<"messages">, Array<Id<"messages">>>;
type UserMessageIdByMessageId = Record<Id<"messages">, Id<"messages">>;
type ActiveAssistantMessageIdByUserMessageId = Record<Id<"messages">, Id<"messages">>;

type ThreadMessagesState = {
  allMessageIds: Array<Id<"messages">>;
  messageIds: Array<Id<"messages">>;
  messagesById: Record<Id<"messages">, ChatMessage>;

  variantMessageIdsByUserMessageId: VariantMessageIdsByUserMessageId;
  userMessageIdByMessageId: UserMessageIdByMessageId;
  activeAssistantMessageIdByUserMessageId: ActiveAssistantMessageIdByUserMessageId;

  localMetaById: Record<Id<"messages">, LocalMessageMeta>;

  /**
   * Monotonic token used to ignore out-of-order sync attempts for the same thread.
   * The caller should pass an incrementing value per-thread.
   */
  latestAppliedSyncToken: number;
};

export type StreamControllerEntry = {
  controller: AbortController;
  streamId?: string;
  assistantMessageId?: Id<"messages">;
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

  allMessageIds: Array<Id<"messages">>;
  variantMessageIdsByUserMessageId: VariantMessageIdsByUserMessageId;
  userMessageIdByMessageId: UserMessageIdByMessageId;
  activeAssistantMessageIdByUserMessageId: ActiveAssistantMessageIdByUserMessageId;

  threadsById: Record<Id<"threads">, ThreadMessagesState>;

  /**
   * Merge server snapshot into the per-thread cache.
   * Must not downgrade local streaming progress with an older server snapshot.
   */
  syncMessages: (
    threadId: Id<"threads">,
    payload: {
      messages: ChatMessage[];
      allMessages?: ChatMessage[];
      variantMessageIdsByUserMessageId?: VariantMessageIdsByUserMessageId;
    },
    syncToken?: number,
  ) => void;

  selectAssistantVariant: (
    threadId: Id<"threads">,
    userMessageId: Id<"messages">,
    assistantMessageId: Id<"messages">,
  ) => void;

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

  /**
   * Mark a message as aborted locally (used for immediate UI feedback).
   * Also normalizes any streaming parts to `state: "done"` so the UI won't think it's still streaming.
   */
  markMessageAborted: (threadId: Id<"threads">, id: Id<"messages">) => void;

  controllers: Record<Id<"threads">, StreamControllerEntry>;
  setController: (threadId: Id<"threads">, entry: StreamControllerEntry) => void;
  removeController: (threadId: Id<"threads">) => void;
};

export const useMessageStore = create<MessagesStore>()(
  immer((set) => {
    function sortMessagesByCreatedAt(messages: ChatMessage[]): ChatMessage[] {
      const sorted = [...messages];

      sorted.sort((a, b) => {
        const createdAtDelta = a.createdAt - b.createdAt;
        if (createdAtDelta !== 0) return createdAtDelta;

        const creationTimeDelta = a._creationTime - b._creationTime;
        if (creationTimeDelta !== 0) return creationTimeDelta;

        return a.updatedAt - b.updatedAt;
      });

      return sorted;
    }

    function sanitizeVariantMap(
      variantMap: VariantMessageIdsByUserMessageId,
      messagesById: Record<Id<"messages">, ChatMessage>,
    ): VariantMessageIdsByUserMessageId {
      const next: VariantMessageIdsByUserMessageId = {};

      const userMessageIds = Object.keys(variantMap) as Array<Id<"messages">>;
      for (const userMessageId of userMessageIds) {
        const userMessage = messagesById[userMessageId];
        if (!userMessage || userMessage.role !== "user") continue;

        const variants = variantMap[userMessageId] ?? [];
        const nextVariants: Array<Id<"messages">> = [];

        for (const variantId of variants) {
          const assistantMessage = messagesById[variantId];
          if (!assistantMessage || assistantMessage.role !== "assistant") continue;
          nextVariants.push(variantId);
        }

        if (nextVariants.length === 0) continue;
        next[userMessageId] = nextVariants;
      }

      return next;
    }

    function buildVariantMapFromCanonical(
      messages: ChatMessage[],
    ): VariantMessageIdsByUserMessageId {
      const next: VariantMessageIdsByUserMessageId = {};

      let previousUserMessageId: Id<"messages"> | null = null;
      for (const message of messages) {
        if (message.role === "user") {
          previousUserMessageId = message._id;
          continue;
        }

        if (message.role !== "assistant") continue;
        if (!previousUserMessageId) continue;

        if (!next[previousUserMessageId]) {
          next[previousUserMessageId] = [];
        }

        next[previousUserMessageId]!.push(message._id);
      }

      return next;
    }

    function buildUserMessageMap(
      canonicalMessages: ChatMessage[],
      allMessagesById: Record<Id<"messages">, ChatMessage>,
      variantMap: VariantMessageIdsByUserMessageId,
    ): UserMessageIdByMessageId {
      const next: UserMessageIdByMessageId = {};

      for (const message of canonicalMessages) {
        if (message.role === "user") {
          next[message._id] = message._id;
        }
      }

      let previousUserMessageId: Id<"messages"> | null = null;
      for (const message of canonicalMessages) {
        if (message.role === "user") {
          previousUserMessageId = message._id;
          continue;
        }

        if (message.role !== "assistant") continue;

        const parentUserMessageId = message.parentUserMessageId ?? previousUserMessageId;
        if (!parentUserMessageId) continue;

        next[message._id] = parentUserMessageId;
      }

      const userMessageIds = Object.keys(variantMap) as Array<Id<"messages">>;
      for (const userMessageId of userMessageIds) {
        next[userMessageId] = userMessageId;

        const variants = variantMap[userMessageId] ?? [];
        for (const variantId of variants) {
          next[variantId] = userMessageId;
        }
      }

      const messageIds = Object.keys(allMessagesById) as Array<Id<"messages">>;
      for (const messageId of messageIds) {
        const message = allMessagesById[messageId];
        if (!message || message.role !== "assistant") continue;

        if (!message.parentUserMessageId) continue;
        next[messageId] = message.parentUserMessageId;
      }

      return next;
    }

    function buildActiveAssistantMap(
      canonicalMessages: ChatMessage[],
      variantMap: VariantMessageIdsByUserMessageId,
      userMessageMap: UserMessageIdByMessageId,
    ): ActiveAssistantMessageIdByUserMessageId {
      const next: ActiveAssistantMessageIdByUserMessageId = {};

      let previousUserMessageId: Id<"messages"> | null = null;
      for (const message of canonicalMessages) {
        if (message.role === "user") {
          previousUserMessageId = message._id;
          continue;
        }

        if (message.role !== "assistant") continue;

        const userMessageId = userMessageMap[message._id] ?? previousUserMessageId;
        if (!userMessageId) continue;

        next[userMessageId] = message._id;
      }

      const userMessageIds = Object.keys(variantMap) as Array<Id<"messages">>;
      for (const userMessageId of userMessageIds) {
        if (next[userMessageId]) continue;

        const variants = variantMap[userMessageId] ?? [];
        const latestVariantId = variants[variants.length - 1];
        if (!latestVariantId) continue;

        next[userMessageId] = latestVariantId;
      }

      return next;
    }

    function ensureThreadStateInDraft(
      state: MessagesStore,
      threadId: Id<"threads">,
    ): ThreadMessagesState {
      const existing = state.threadsById[threadId];
      if (existing) return existing;

      const created: ThreadMessagesState = {
        allMessageIds: [],
        messageIds: [],
        messagesById: {},

        variantMessageIdsByUserMessageId: {},
        userMessageIdByMessageId: {},
        activeAssistantMessageIdByUserMessageId: {},

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
        state.allMessageIds = [];
        state.messageIds = [];
        state.messagesById = {};

        state.variantMessageIdsByUserMessageId = {};
        state.userMessageIdByMessageId = {};
        state.activeAssistantMessageIdByUserMessageId = {};
        return;
      }

      const thread = state.threadsById[threadId];
      if (!thread) {
        state.allMessageIds = [];
        state.messageIds = [];
        state.messagesById = {};

        state.variantMessageIdsByUserMessageId = {};
        state.userMessageIdByMessageId = {};
        state.activeAssistantMessageIdByUserMessageId = {};
        return;
      }

      state.allMessageIds = thread.allMessageIds;
      state.messageIds = thread.messageIds;
      state.messagesById = thread.messagesById;

      state.variantMessageIdsByUserMessageId = thread.variantMessageIdsByUserMessageId;
      state.userMessageIdByMessageId = thread.userMessageIdByMessageId;
      state.activeAssistantMessageIdByUserMessageId =
        thread.activeAssistantMessageIdByUserMessageId;
    }

    function mergeServerMessage(
      existing: ChatMessage,
      incoming: ChatMessage,
      localMeta: LocalMessageMeta | undefined,
    ): ChatMessage {
      const localComparableTime = Math.max(existing.updatedAt, localMeta?.localUpdatedAt ?? 0);
      const localHasStreamProgress = (localMeta?.localRevision ?? 0) > 0;

      if (localHasStreamProgress && incoming.updatedAt < localComparableTime) {
        const isAbortUpdate =
          incoming.metadata?.finishReason === "aborted" ||
          (incoming.status === "complete" && incoming.resumableStreamId === null);

        // Server snapshot is behind what the client has already accumulated from streaming.
        // Keep local streaming-sensitive fields while still allowing server to fill in other fields.
        // Exception: abort completion is a terminal update, so we must accept it even if timestamps race.
        return {
          ...incoming,
          parts: existing.parts,
          status: isAbortUpdate ? incoming.status : existing.status,
          metadata: isAbortUpdate ? incoming.metadata : existing.metadata,
          error: incoming.error ?? existing.error,
          resumableStreamId: isAbortUpdate
            ? incoming.resumableStreamId
            : (incoming.resumableStreamId ?? existing.resumableStreamId),
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

      allMessageIds: [],
      variantMessageIdsByUserMessageId: {},
      userMessageIdByMessageId: {},
      activeAssistantMessageIdByUserMessageId: {},

      threadsById: {},

      clearMessages: function clearMessages() {
        // Clear only the view state (keep per-thread cache so navigation won't regress streaming state).
        set(function clear(state) {
          state.allMessageIds = [];
          state.messageIds = [];
          state.messagesById = {};

          state.variantMessageIdsByUserMessageId = {};
          state.userMessageIdByMessageId = {};
          state.activeAssistantMessageIdByUserMessageId = {};
        });
      },

      syncMessages: function syncMessages(threadId, payload, syncToken) {
        set(function sync(state) {
          const thread = ensureThreadStateInDraft(state, threadId);

          if (syncToken !== undefined && syncToken < thread.latestAppliedSyncToken) {
            return;
          }
          if (syncToken !== undefined) {
            thread.latestAppliedSyncToken = syncToken;
          }

          const canonicalMessages = sortMessagesByCreatedAt(payload.messages);
          const allMessages = sortMessagesByCreatedAt(payload.allMessages ?? payload.messages);
          const incomingIds = new Set<Id<"messages">>();

          for (const msg of allMessages) {
            incomingIds.add(msg._id);

            const existing = thread.messagesById[msg._id];
            if (!existing) {
              thread.messagesById[msg._id] = msg;
              continue;
            }

            const localMeta = thread.localMetaById[msg._id];
            thread.messagesById[msg._id] = mergeServerMessage(existing, msg, localMeta);
          }

          for (const cachedMessage of Object.values(thread.messagesById)) {
            if (incomingIds.has(cachedMessage._id)) continue;

            delete thread.messagesById[cachedMessage._id];
            delete thread.localMetaById[cachedMessage._id];
          }

          const activeController = state.controllers[threadId];
          if (
            activeController?.assistantMessageId &&
            !incomingIds.has(activeController.assistantMessageId)
          ) {
            delete state.controllers[threadId];
          }

          const nextAllMessageIds: Array<Id<"messages">> = [];
          for (const message of allMessages) {
            nextAllMessageIds.push(message._id);
          }

          const nextCanonicalMessageIds: Array<Id<"messages">> = [];
          for (const message of canonicalMessages) {
            nextCanonicalMessageIds.push(message._id);
          }

          const baseVariantMap = payload.variantMessageIdsByUserMessageId
            ? sanitizeVariantMap(payload.variantMessageIdsByUserMessageId, thread.messagesById)
            : buildVariantMapFromCanonical(canonicalMessages);

          const nextUserMessageMap = buildUserMessageMap(
            canonicalMessages,
            thread.messagesById,
            baseVariantMap,
          );

          const nextActiveAssistantMap = buildActiveAssistantMap(
            canonicalMessages,
            baseVariantMap,
            nextUserMessageMap,
          );

          thread.allMessageIds = nextAllMessageIds;
          thread.messageIds = nextCanonicalMessageIds;

          thread.variantMessageIdsByUserMessageId = baseVariantMap;
          thread.userMessageIdByMessageId = nextUserMessageMap;
          thread.activeAssistantMessageIdByUserMessageId = nextActiveAssistantMap;

          if (state.currentThreadId === threadId) {
            updateCurrentViewFromThread(state, threadId);
          }
        });
      },

      selectAssistantVariant: function selectAssistantVariant(
        threadId,
        userMessageId,
        assistantMessageId,
      ) {
        set(function select(state) {
          const thread = ensureThreadStateInDraft(state, threadId);
          const variants = thread.variantMessageIdsByUserMessageId[userMessageId] ?? [];

          let hasVariant = false;
          for (const variantId of variants) {
            if (variantId !== assistantMessageId) continue;
            hasVariant = true;
            break;
          }

          if (!hasVariant) return;

          const assistantMessage = thread.messagesById[assistantMessageId];
          if (!assistantMessage || assistantMessage.role !== "assistant") return;

          thread.activeAssistantMessageIdByUserMessageId[userMessageId] = assistantMessageId;

          const userIndex = thread.messageIds.indexOf(userMessageId);
          if (userIndex === -1) return;

          const nextMessageId = thread.messageIds[userIndex + 1];
          const nextMessage = nextMessageId ? thread.messagesById[nextMessageId] : undefined;

          if (nextMessageId && nextMessage?.role === "assistant") {
            thread.messageIds[userIndex + 1] = assistantMessageId;
          } else {
            thread.messageIds.splice(userIndex + 1, 0, assistantMessageId);
          }

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

      markMessageAborted: function markMessageAborted(threadId, id) {
        set(function update(state) {
          const thread = ensureThreadStateInDraft(state, threadId);
          const msg = thread.messagesById[id];
          if (!msg) return;

          for (const part of msg.parts) {
            if (part.type !== "text" && part.type !== "reasoning") continue;
            if (part.state === "streaming") {
              part.state = "done";
            }
          }

          msg.status = "complete";
          msg.resumableStreamId = null;

          if (msg.metadata) {
            msg.metadata = { ...msg.metadata, finishReason: "aborted" };
          }

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
      setController: function setController(threadId, entry) {
        set(function set(state) {
          state.controllers[threadId] = entry;
        });
      },
      removeController: function removeController(threadId) {
        set(function remove(state) {
          delete state.controllers[threadId];
        });
      },
    };
  }),
);

export const messageStoreActions =
  useMessageStore.getInitialState() as RemoveAllExceptFunctions<MessagesStore>;
