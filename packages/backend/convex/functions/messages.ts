import { getAll } from "convex-helpers/server/relationships";
import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { authenticatedMutation, authenticatedQuery, r2 } from "../components";
import { AISDKMetadata, AISDKModelParams, AISDKParts, status } from "../schema";

type MessageDoc = Doc<"messages">;
type UserMessageDoc = MessageDoc & { role: "user" };
type AssistantMessageDoc = MessageDoc & { role: "assistant" };
type DeleteScope = "turnAndBelow" | "assistantVariantOnly";

const DEFAULT_THREAD_MESSAGES_PAGE_SIZE = 60;
const MAX_THREAD_MESSAGES_PAGE_SIZE = 200;

type ThreadMessageGraph = {
  messagesById: Record<Id<"messages">, MessageDoc>;

  users: UserMessageDoc[];
  userById: Record<Id<"messages">, UserMessageDoc>;

  assistantsByUserId: Record<Id<"messages">, AssistantMessageDoc[]>;
  parentUserIdByAssistantId: Record<Id<"messages">, Id<"messages">>;
  activeAssistantByUserId: Record<Id<"messages">, AssistantMessageDoc>;

  canonicalMessageIds: Array<Id<"messages">>;
};

function isUserMessage(message: MessageDoc): message is UserMessageDoc {
  return message.role === "user";
}

function isAssistantMessage(message: MessageDoc): message is AssistantMessageDoc {
  return message.role === "assistant";
}

function sortMessagesAscending(messages: MessageDoc[]): MessageDoc[] {
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

function sortAssistantVariants(variants: AssistantMessageDoc[]): AssistantMessageDoc[] {
  const sorted = [...variants];

  sorted.sort((a, b) => {
    const aVariantIndex = a.variantIndex;
    const bVariantIndex = b.variantIndex;

    if (aVariantIndex !== undefined && bVariantIndex !== undefined) {
      const variantDelta = aVariantIndex - bVariantIndex;
      if (variantDelta !== 0) return variantDelta;
    }

    const createdAtDelta = a.createdAt - b.createdAt;
    if (createdAtDelta !== 0) return createdAtDelta;

    return a._creationTime - b._creationTime;
  });

  return sorted;
}

function findFallbackParentUserId(
  users: UserMessageDoc[],
  assistant: AssistantMessageDoc,
): Id<"messages"> | null {
  let fallbackUserId: Id<"messages"> | null = null;

  for (const userMessage of users) {
    if (userMessage._creationTime > assistant._creationTime) break;
    fallbackUserId = userMessage._id;
  }

  return fallbackUserId;
}

function buildThreadMessageGraph(messages: MessageDoc[]): ThreadMessageGraph {
  const sortedMessages = sortMessagesAscending(messages);

  const messagesById: Record<Id<"messages">, MessageDoc> = {};
  const users: UserMessageDoc[] = [];
  const assistants: AssistantMessageDoc[] = [];

  for (const message of sortedMessages) {
    messagesById[message._id] = message;

    if (isUserMessage(message)) {
      users.push(message);
      continue;
    }

    if (isAssistantMessage(message)) {
      assistants.push(message);
    }
  }

  const userById: Record<Id<"messages">, UserMessageDoc> = {};
  for (const userMessage of users) {
    userById[userMessage._id] = userMessage;
  }

  const assistantsByUserId: Record<Id<"messages">, AssistantMessageDoc[]> = {};
  const parentUserIdByAssistantId: Record<Id<"messages">, Id<"messages">> = {};

  for (const assistantMessage of assistants) {
    let parentUserMessageId: Id<"messages"> | null = null;

    if (assistantMessage.parentUserMessageId) {
      const parentUser = userById[assistantMessage.parentUserMessageId];
      if (parentUser) {
        parentUserMessageId = parentUser._id;
      }
    }

    if (parentUserMessageId === null) {
      parentUserMessageId = findFallbackParentUserId(users, assistantMessage);
    }

    if (parentUserMessageId === null) continue;

    if (!assistantsByUserId[parentUserMessageId]) {
      assistantsByUserId[parentUserMessageId] = [];
    }

    assistantsByUserId[parentUserMessageId]!.push(assistantMessage);
    parentUserIdByAssistantId[assistantMessage._id] = parentUserMessageId;
  }

  const groupedUserMessageIds = Object.keys(assistantsByUserId) as Array<Id<"messages">>;
  for (const userMessageId of groupedUserMessageIds) {
    const variants = assistantsByUserId[userMessageId];
    if (!variants || variants.length === 0) continue;
    assistantsByUserId[userMessageId] = sortAssistantVariants(variants);
  }

  const activeAssistantByUserId: Record<Id<"messages">, AssistantMessageDoc> = {};
  const canonicalMessageIds: Array<Id<"messages">> = [];

  for (const userMessage of users) {
    canonicalMessageIds.push(userMessage._id);

    const variants = assistantsByUserId[userMessage._id] ?? [];
    if (variants.length === 0) continue;

    let activeAssistant: AssistantMessageDoc | null = null;

    if (userMessage.activeAssistantMessageId) {
      for (const variant of variants) {
        if (variant._id === userMessage.activeAssistantMessageId) {
          activeAssistant = variant;
          break;
        }
      }
    }

    if (activeAssistant === null) {
      activeAssistant = variants[variants.length - 1] ?? null;
    }

    if (activeAssistant === null) continue;

    activeAssistantByUserId[userMessage._id] = activeAssistant;
    canonicalMessageIds.push(activeAssistant._id);
  }

  return {
    messagesById,
    users,
    userById,
    assistantsByUserId,
    parentUserIdByAssistantId,
    activeAssistantByUserId,
    canonicalMessageIds,
  };
}

function resolveUserMessageIdForMessage(
  graph: ThreadMessageGraph,
  messageId: Id<"messages">,
): Id<"messages"> | null {
  const message = graph.messagesById[messageId];
  if (!message) return null;

  if (message.role === "user") return message._id;

  return graph.parentUserIdByAssistantId[message._id] ?? null;
}

function collectMessagesFromUserTurnIndex(
  graph: ThreadMessageGraph,
  userTurnStartIndex: number,
): MessageDoc[] {
  const toDelete: MessageDoc[] = [];
  const seen = new Set<Id<"messages">>();

  for (let i = userTurnStartIndex; i < graph.users.length; i += 1) {
    const userMessage = graph.users[i];
    if (!userMessage) continue;

    if (!seen.has(userMessage._id)) {
      seen.add(userMessage._id);
      toDelete.push(userMessage);
    }

    const variants = graph.assistantsByUserId[userMessage._id] ?? [];
    for (const assistantMessage of variants) {
      if (seen.has(assistantMessage._id)) continue;
      seen.add(assistantMessage._id);
      toDelete.push(assistantMessage);
    }
  }

  return toDelete;
}

function getNextVariantIndex(variants: AssistantMessageDoc[]): number {
  let maxVariantIndex = -1;
  let fallbackIndex = 0;

  for (const variant of variants) {
    const currentIndex = variant.variantIndex ?? fallbackIndex;
    if (currentIndex > maxVariantIndex) {
      maxVariantIndex = currentIndex;
    }

    fallbackIndex += 1;
  }

  return maxVariantIndex + 1;
}

async function patchThreadModelConfig(
  ctx: MutationCtx,
  threadId: Id<"threads">,
  model: string,
  modelParams: (typeof AISDKModelParams)["type"],
) {
  await ctx.db.patch("threads", threadId, {
    latestModel: model,
    latestModelParams: modelParams,
  });
}

type AssistantCompletionTrackingPayload = {
  userId: string;
  modelUniqueId: string;
  messageId: Id<"messages">;
  profileId?: Id<"profiles">;

  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
};

const assistantCompletionTrackingPayloadValidator = v.object({
  userId: v.string(),

  modelUniqueId: v.string(),
  messageId: v.id("messages"),
  profileId: v.optional(v.id("profiles")),

  inputTokens: v.number(),
  outputTokens: v.number(),
  reasoningTokens: v.number(),
});

export const getAllMessagesFromThread = authenticatedQuery({
  args: {
    threadId: v.id("threads"),
    limit: v.optional(v.number()),
    beforeCreatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;

    if (!user) throw new Error("Not authenticated");
    if (!args.threadId) throw new Error("Thread not found");

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread?.userId !== user.userId) throw new Error("Not authorized");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.userId).eq("threadId", args.threadId),
      )
      .order("asc")
      .collect();

    const safeLimit = Math.max(
      1,
      Math.min(
        MAX_THREAD_MESSAGES_PAGE_SIZE,
        Math.floor(args.limit ?? DEFAULT_THREAD_MESSAGES_PAGE_SIZE),
      ),
    );
    const beforeCreatedAt = args.beforeCreatedAt;

    type MessageWithAttachments = Omit<Doc<"messages">, "attachments"> & {
      attachments: Doc<"attachments">[];
    };

    const messagesById: Record<Id<"messages">, MessageDoc> = {};
    for (const message of messages) {
      messagesById[message._id] = message;
    }

    const graph = buildThreadMessageGraph(messages);

    const canonicalMessageIds = graph.canonicalMessageIds;
    let endExclusive = canonicalMessageIds.length;

    if (beforeCreatedAt !== undefined) {
      for (let i = canonicalMessageIds.length - 1; i >= 0; i -= 1) {
        const messageId = canonicalMessageIds[i];
        if (!messageId) continue;

        const candidate = messagesById[messageId];
        if (!candidate) continue;

        if (candidate.createdAt < beforeCreatedAt) {
          endExclusive = i + 1;
          break;
        }

        endExclusive = i;
      }
    }

    const startInclusive = Math.max(0, endExclusive - safeLimit);
    let adjustedStartInclusive = startInclusive;

    const firstSliceMessageId = canonicalMessageIds[adjustedStartInclusive];
    const firstSliceMessage = firstSliceMessageId ? graph.messagesById[firstSliceMessageId] : null;

    if (firstSliceMessage?.role === "assistant" && adjustedStartInclusive > 0) {
      adjustedStartInclusive -= 1;
    }

    const canonicalSliceIds = canonicalMessageIds.slice(adjustedStartInclusive, endExclusive);

    const sliceUserMessageIds = new Set<Id<"messages">>();
    for (const messageId of canonicalSliceIds) {
      const message = graph.messagesById[messageId];
      if (!message) continue;

      if (message.role === "user") {
        sliceUserMessageIds.add(message._id);
        continue;
      }

      const parentUserMessageId = message.parentUserMessageId;
      if (parentUserMessageId) {
        sliceUserMessageIds.add(parentUserMessageId);
      }
    }

    const visibleMessageIds = new Set<Id<"messages">>(canonicalSliceIds);
    for (const userMessageId of sliceUserMessageIds) {
      visibleMessageIds.add(userMessageId);

      const variants = graph.assistantsByUserId[userMessageId] ?? [];
      for (const variant of variants) {
        visibleMessageIds.add(variant._id);
      }
    }

    const visibleMessages: MessageDoc[] = [];
    for (const messageId of visibleMessageIds) {
      const message = graph.messagesById[messageId];
      if (!message) continue;
      visibleMessages.push(message);
    }

    const attachmentIdSet = new Set<Id<"attachments">>();
    for (const message of visibleMessages) {
      for (const attachmentId of message.attachments) {
        attachmentIdSet.add(attachmentId);
      }
    }

    const attachmentIds = Array.from(attachmentIdSet);
    const attachmentDocs = attachmentIds.length > 0 ? await getAll(ctx.db, attachmentIds) : [];

    const attachmentsById: Record<Id<"attachments">, Doc<"attachments">> = {};
    for (const attachmentDoc of attachmentDocs) {
      if (!attachmentDoc) continue;
      attachmentsById[attachmentDoc._id] = attachmentDoc;
    }

    const hydratedVisibleMessagesById: Record<Id<"messages">, MessageWithAttachments> = {};
    for (const message of visibleMessages) {
      const attachments: Doc<"attachments">[] = [];

      for (const attachmentId of message.attachments) {
        const attachment = attachmentsById[attachmentId];
        if (!attachment) continue;
        attachments.push(attachment);
      }

      hydratedVisibleMessagesById[message._id] = {
        ...message,
        attachments,
      };
    }

    const allMessages: MessageWithAttachments[] = [];
    const sortedVisibleMessages = sortMessagesAscending(visibleMessages);
    for (const message of sortedVisibleMessages) {
      const hydrated = hydratedVisibleMessagesById[message._id];
      if (!hydrated) continue;
      allMessages.push(hydrated);
    }

    const canonicalMessages: MessageWithAttachments[] = [];
    for (const messageId of canonicalSliceIds) {
      const message = hydratedVisibleMessagesById[messageId];
      if (!message) continue;
      canonicalMessages.push(message);
    }

    const variantMessageIdsByUserMessageId: Record<Id<"messages">, Array<Id<"messages">>> = {};

    for (const userMessageId of sliceUserMessageIds) {
      const variants = graph.assistantsByUserId[userMessageId] ?? [];
      if (variants.length === 0) continue;

      variantMessageIdsByUserMessageId[userMessageId] = [];

      for (const variant of variants) {
        variantMessageIdsByUserMessageId[userMessageId]!.push(variant._id);
      }
    }

    return {
      messages: canonicalMessages,
      allMessages,
      thread,
      variantMessageIdsByUserMessageId,
      hasOlderMessages: adjustedStartInclusive > 0,
    };
  },
});

export const getAllMessagesWithoutAttachments = authenticatedQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.userId).eq("threadId", args.threadId!),
      )
      .order("asc")
      .collect();

    const graph = buildThreadMessageGraph(messages);

    const canonicalMessages: MessageDoc[] = [];
    for (const messageId of graph.canonicalMessageIds) {
      const message = graph.messagesById[messageId];
      if (!message) continue;
      canonicalMessages.push(message);
    }

    return canonicalMessages;
  },
});

export const canResumeStream = authenticatedQuery({
  args: { streamId: v.string() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db
      .query("messages")
      .withIndex("by_userId_resumableStreamId", (q) =>
        q.eq("userId", user.userId).eq("resumableStreamId", args.streamId),
      )
      .first();

    return message?.status === "streaming";
  },
});

export const addAttachmentsToMessage = authenticatedMutation({
  args: {
    messageId: v.string(),
    parts: AISDKParts,
    attachmentIds: v.array(v.id("attachments")),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();

    if (!message) throw new Error("Message not found");
    if (message.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch("messages", message._id, {
      parts: args.parts,
      attachments: args.attachmentIds,
    });
  },
});

export const addMessagesToThread = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    messages: v.array(
      v.object({
        messageId: v.string(),
        role: v.union(v.literal("assistant"), v.literal("user")),

        status: status,
        parts: AISDKParts,
        metadata: v.optional(AISDKMetadata),

        attachments: v.array(v.id("attachments")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const [userMessage, assistantMessage] = args.messages as [
      (typeof args.messages)[0],
      (typeof args.messages)[1],
    ];

    if (!userMessage || !assistantMessage) {
      throw new Error("Messages payload must contain user and assistant messages");
    }

    if (userMessage.role !== "user" || assistantMessage.role !== "assistant") {
      throw new Error("Messages payload must be [user, assistant]");
    }

    const now = Date.now();

    const shared = {
      threadId: args.threadId,
      userId: user.userId,
      createdAt: now,
      updatedAt: now,

      metadata: undefined,
      resumableStreamId: null,
    };

    const userMessageId = await ctx.db.insert("messages", {
      ...shared,
      ...userMessage,

      activeAssistantMessageId: undefined,
      parentUserMessageId: undefined,
      variantIndex: undefined,
    });

    const assistantMessageId = await ctx.db.insert("messages", {
      ...shared,
      ...assistantMessage,
      // So that we can sort by createdAt and have the assistant message come after the user message
      createdAt: now + 1,

      parentUserMessageId: userMessageId,
      variantIndex: 0,
      activeAssistantMessageId: undefined,
    });

    await ctx.db.patch(userMessageId, {
      activeAssistantMessageId: assistantMessageId,
    });

    if (assistantMessage.metadata) {
      await patchThreadModelConfig(
        ctx,
        args.threadId,
        assistantMessage.metadata.model.request,
        assistantMessage.metadata.modelParams,
      );
    }

    await ctx.runMutation(internal.functions.user_stats.incrementOnUserMessage, {
      userId: user.userId,
      threadId: args.threadId,
      createdAt: now,
    });

    return assistantMessageId;
  },
});

export const updateErrorMessage = authenticatedMutation({
  args: {
    error: v.string(),
    messageId: v.id("messages"),
    metadata: v.optional(AISDKMetadata.partial()),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get("messages", args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== user.userId) throw new Error("User not authorized");

    const metadata = { ...message.metadata, ...args.metadata } as (typeof AISDKMetadata)["type"];

    await ctx.db.patch(args.messageId, {
      status: "error",
      error: args.error,
      resumableStreamId: null,
      updatedAt: Date.now(),

      parts: [{ type: "text", text: args.error, state: "done" }],

      metadata,
    });

    await ctx.db.patch(message.threadId, {
      updatedAt: Date.now(),
      status: "complete",
    });
  },
});

export const getAssistantCompletionTrackingPayloadById = authenticatedQuery({
  args: { messageId: v.id("messages") },
  returns: v.union(assistantCompletionTrackingPayloadValidator, v.null()),
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get("messages", args.messageId);
    if (!message) return null;
    if (message.userId !== user.userId) throw new Error("User not authorized");
    if (message.role !== "assistant") return null;
    if (message.status !== "complete") return null;

    const metadata = message.metadata;
    if (!metadata) return null;
    if (metadata.finishReason === "aborted") return null;

    const payload: AssistantCompletionTrackingPayload = {
      messageId: message._id,
      userId: message.userId,
      modelUniqueId: metadata.model.request ?? "",

      inputTokens: metadata.usages.inputTokens ?? 0,
      outputTokens: metadata.usages.outputTokens ?? 0,
      reasoningTokens: metadata.usages.reasoningTokens ?? 0,

      ...(metadata.modelParams.profile ? { profileId: metadata.modelParams.profile } : {}),
    };

    return payload;
  },
});

export const applyAssistantCompletionTracking = internalMutation({
  args: { tracking: assistantCompletionTrackingPayloadValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("messages", args.tracking.messageId);
    if (!message) return null;

    const trackedAt = message.statsTrackedAt ?? 0;
    if (trackedAt > 0) return null;

    await ctx.runMutation(internal.functions.user_stats.incrementOnAssistantComplete, {
      userId: args.tracking.userId,
      modelUniqueId: args.tracking.modelUniqueId,
      ...(args.tracking.profileId ? { profileId: args.tracking.profileId } : {}),

      inputTokens: args.tracking.inputTokens,
      outputTokens: args.tracking.outputTokens,
      reasoningTokens: args.tracking.reasoningTokens,
    });

    await ctx.db.patch(args.tracking.messageId, {
      statsTrackedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const trackFinishedMessageById = action({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tracking: AssistantCompletionTrackingPayload | null = await ctx.runQuery(
      api.functions.messages.getAssistantCompletionTrackingPayloadById,
      { messageId: args.messageId },
    );

    if (!tracking) return null;

    await ctx.runMutation(internal.functions.messages.applyAssistantCompletionTracking, {
      tracking,
    });

    return null;
  },
});

export const updateMessageById = authenticatedMutation({
  args: {
    messageId: v.id("messages"),
    updates: v
      .object({
        status: status,
        resumableStreamId: v.nullable(v.string()),

        parts: v.any(),
        metadata: AISDKMetadata,
        attachments: v.array(v.id("attachments")),
      })
      .partial(),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get("messages", args.messageId);
    console.log("Updating message by Id", {
      userId: user.userId,
      messageId: args.messageId,
      messageUserId: message?.userId ?? "Message not found",
      status: args.updates.status,
      messageThreadId: message?.threadId ?? "Message not found",
      reason: args.updates.metadata?.finishReason,
    });

    if (!message) throw new Error("Message not found");
    if (message.userId !== user.userId) throw new Error("User not authorized");
    if (message.status === "error") return;

    const isAbortedCompletion =
      message.status === "complete" && message.metadata?.finishReason === "aborted";
    if (isAbortedCompletion && args.updates.status === "streaming") return;

    if (args.updates.status === "complete") {
      throw new Error("Use updateFinishedMessageById for completed messages");
    }

    await ctx.db.patch("messages", args.messageId, { ...args.updates, updatedAt: Date.now() });
    await ctx.db.patch("threads", message.threadId, {
      status: args.updates.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateFinishedMessageById = authenticatedMutation({
  args: {
    messageId: v.id("messages"),
    updates: v
      .object({
        status: v.literal("complete"),
        resumableStreamId: v.nullable(v.string()),
        parts: v.any(),
        metadata: AISDKMetadata,
        attachments: v.array(v.id("attachments")),
      })
      .partial(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get("messages", args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== user.userId) throw new Error("User not authorized");
    if (message.status === "error") return false;
    if (message.status === "complete") return false;

    await ctx.db.patch("messages", args.messageId, {
      ...args.updates,
      statsTrackedAt: undefined,
      updatedAt: Date.now(),
    });

    await ctx.db.patch("threads", message.threadId, {
      status: "complete",
      updatedAt: Date.now(),
    });

    if (message.role !== "assistant") return false;

    const metadata = args.updates.metadata ?? message.metadata;
    if (!metadata) return false;
    return metadata.finishReason !== "aborted";
  },
});

export const retryChatMessage = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    assistantMessageId: v.id("messages"),

    model: v.string(),
    modelParams: AISDKModelParams,

    userMessage: v.optional(
      v.object({
        parts: v.any(),
        messageId: v.id("messages"),
        attachments: v.array(v.id("attachments")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const targetAssistantMessage = await ctx.db.get("messages", args.assistantMessageId);
    if (!targetAssistantMessage) throw new Error("Message not found");
    if (targetAssistantMessage.userId !== user.userId) throw new Error("Not authorized");
    if (targetAssistantMessage.role !== "assistant") {
      throw new Error("Retry target must be an assistant message");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.userId).eq("threadId", args.threadId),
      )
      .order("asc")
      .collect();

    const graph = buildThreadMessageGraph(messages);

    const resolvedUserMessageId = resolveUserMessageIdForMessage(graph, targetAssistantMessage._id);
    if (!resolvedUserMessageId) {
      throw new Error("Could not resolve user message for retry target");
    }

    const userTurnIndex = graph.users.findIndex((message) => message._id === resolvedUserMessageId);
    if (userTurnIndex === -1) {
      throw new Error("User turn not found");
    }

    const messagesToDelete = collectMessagesFromUserTurnIndex(graph, userTurnIndex + 1);

    if (args.userMessage) {
      if (args.userMessage.messageId !== resolvedUserMessageId) {
        throw new Error("Edited message must match the retried user turn");
      }

      await ctx.db.patch(args.userMessage.messageId, {
        updatedAt: Date.now(),
        parts: args.userMessage.parts,
        attachments: args.userMessage.attachments,
      });
    }

    for (const message of messagesToDelete) {
      await ctx.db.delete(message._id);
    }

    const variants = graph.assistantsByUserId[resolvedUserMessageId] ?? [];
    const variantIndex = getNextVariantIndex(variants);
    const now = Date.now();

    const assistantMessageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      userId: user.userId,

      messageId: crypto.randomUUID(),
      status: "pending",
      parts: [],
      attachments: [],

      role: "assistant",
      resumableStreamId: null,
      error: undefined,

      parentUserMessageId: resolvedUserMessageId,
      variantIndex,
      activeAssistantMessageId: undefined,

      createdAt: now,
      updatedAt: now,

      metadata: {
        durations: { request: 0, reasoning: 0, text: 0 },
        usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
        timeToFirstTokenMs: 0,
        finishReason: null,

        modelParams: args.modelParams,
        model: { request: args.model, response: null },
      },
    });

    await Promise.all([
      ctx.db.patch("threads", args.threadId, { status: "pending", updatedAt: now }),
      ctx.db.patch("messages", resolvedUserMessageId, {
        updatedAt: now,
        activeAssistantMessageId: assistantMessageId,
      }),
    ]);

    await patchThreadModelConfig(ctx, args.threadId, args.model, args.modelParams);

    return { assistantMessageId, userMessageId: resolvedUserMessageId };
  },
});

export const setActiveAssistantVariant = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    userMessageId: v.id("messages"),
    assistantMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const userMessage = await ctx.db.get("messages", args.userMessageId);
    if (!userMessage) throw new Error("User message not found");
    if (userMessage.role !== "user") throw new Error("Target user message is invalid");
    if (userMessage.threadId !== args.threadId) throw new Error("User message is not in thread");

    const assistantMessage = await ctx.db.get("messages", args.assistantMessageId);
    if (!assistantMessage) throw new Error("Assistant message not found");
    if (assistantMessage.role !== "assistant")
      throw new Error("Target assistant message is invalid");
    if (assistantMessage.threadId !== args.threadId) {
      throw new Error("Assistant message is not in thread");
    }

    let resolvedUserMessageId = assistantMessage.parentUserMessageId ?? null;

    if (!resolvedUserMessageId) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_userId_threadId", (q) =>
          q.eq("userId", user.userId).eq("threadId", args.threadId),
        )
        .order("asc")
        .collect();

      const graph = buildThreadMessageGraph(messages);
      resolvedUserMessageId = resolveUserMessageIdForMessage(graph, args.assistantMessageId);
    }

    if (resolvedUserMessageId !== args.userMessageId) {
      throw new Error("Assistant message does not belong to the selected user turn");
    }

    await ctx.db.patch(args.userMessageId, {
      activeAssistantMessageId: args.assistantMessageId,
      updatedAt: Date.now(),
    });

    const latestModel = assistantMessage.metadata?.model.request?.trim();
    if (latestModel) {
      const latestModelParams = assistantMessage.metadata?.modelParams ??
        thread.latestModelParams ?? {
          effort: "medium",
          webSearch: false,
          profile: null,
        };

      await patchThreadModelConfig(ctx, args.threadId, latestModel, latestModelParams);
    }

    return { activeAssistantMessageId: args.assistantMessageId };
  },
});

export const deleteMessageAndBelow = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    deleteAttachments: v.boolean(),
    deleteScope: v.optional(v.union(v.literal("turnAndBelow"), v.literal("assistantVariantOnly"))),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const deleteScope: DeleteScope = args.deleteScope ?? "turnAndBelow";

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");
    if (thread.status === "pending" || thread.status === "streaming") {
      throw new Error("Cannot delete messages while streaming");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.userId).eq("threadId", args.threadId),
      )
      .order("asc")
      .collect();

    const graph = buildThreadMessageGraph(messages);
    const targetMessage = graph.messagesById[args.messageId];
    if (!targetMessage) throw new Error("Message not found");

    const targetUserMessageId = resolveUserMessageIdForMessage(graph, args.messageId);
    if (!targetUserMessageId) throw new Error("Failed to resolve target user turn");

    const targetUserTurnIndex = graph.users.findIndex(
      (message) => message._id === targetUserMessageId,
    );
    if (targetUserTurnIndex === -1) throw new Error("Failed to resolve target user turn");

    const messagesToDeleteMap: Record<Id<"messages">, MessageDoc> = {};

    function addMessageToDelete(message: MessageDoc): void {
      messagesToDeleteMap[message._id] = message;
    }

    if (deleteScope === "assistantVariantOnly") {
      if (targetMessage.role !== "assistant") {
        throw new Error("Variant-only delete is only available for assistant messages");
      }

      const targetVariants = graph.assistantsByUserId[targetUserMessageId] ?? [];
      if (targetVariants.length <= 1) {
        throw new Error("Cannot delete the only response variant");
      }

      let hasTargetVariant = false;
      for (const variant of targetVariants) {
        if (variant._id !== targetMessage._id) continue;
        hasTargetVariant = true;
        break;
      }

      if (!hasTargetVariant) {
        throw new Error("Target variant not found");
      }

      addMessageToDelete(targetMessage);
    } else if (targetMessage.role === "user") {
      const fromTurnMessages = collectMessagesFromUserTurnIndex(graph, targetUserTurnIndex);
      for (const message of fromTurnMessages) {
        addMessageToDelete(message);
      }
    } else {
      const targetVariants = graph.assistantsByUserId[targetUserMessageId] ?? [];
      for (const variant of targetVariants) {
        addMessageToDelete(variant);
      }

      const newerTurnMessages = collectMessagesFromUserTurnIndex(graph, targetUserTurnIndex + 1);
      for (const message of newerTurnMessages) {
        addMessageToDelete(message);
      }
    }

    const messagesToDelete = Object.values(messagesToDeleteMap);
    if (messagesToDelete.length === 0) {
      throw new Error("No messages matched delete request");
    }

    const deletedMessageIds = new Set<Id<"messages">>();
    for (const message of messagesToDelete) {
      deletedMessageIds.add(message._id);
    }

    const messagesToKeep: MessageDoc[] = [];
    for (const message of messages) {
      if (deletedMessageIds.has(message._id)) continue;
      messagesToKeep.push(message);
    }

    const attachmentIdsInDeletedRange = new Set<Id<"attachments">>();

    for (const message of messagesToDelete) {
      for (const attachmentId of message.attachments) {
        attachmentIdsInDeletedRange.add(attachmentId);
      }
    }

    let deletedAttachments = 0;

    if (args.deleteAttachments && attachmentIdsInDeletedRange.size > 0) {
      const usedByRemainingMessages = new Set<Id<"attachments">>();

      for (const message of messagesToKeep) {
        for (const attachmentId of message.attachments) {
          usedByRemainingMessages.add(attachmentId);
        }
      }

      const attachmentIdsToDelete: Array<Id<"attachments">> = [];

      for (const attachmentId of attachmentIdsInDeletedRange) {
        if (usedByRemainingMessages.has(attachmentId)) continue;
        attachmentIdsToDelete.push(attachmentId);
      }

      if (attachmentIdsToDelete.length > 0) {
        const attachments = await getAll(ctx.db, attachmentIdsToDelete);

        for (const attachment of attachments) {
          if (!attachment) continue;
          if (attachment.userId !== user.userId) continue;

          await r2.deleteObject(ctx, attachment.path);
          await ctx.db.delete(attachment._id);
          deletedAttachments += 1;
        }
      }
    }

    for (const message of messagesToDelete) {
      await ctx.db.delete(message._id);
    }

    const remainingUserMessages = graph.users.filter(
      (message) => !deletedMessageIds.has(message._id),
    );

    const userMessagePatchPayloads: Array<{
      userMessageId: Id<"messages">;
      activeAssistantMessageId: Id<"messages"> | undefined;
    }> = [];
    const patchedActiveAssistantByUserId = new Map<Id<"messages">, Id<"messages"> | undefined>();

    for (const userMessage of remainingUserMessages) {
      const variants = graph.assistantsByUserId[userMessage._id] ?? [];

      const remainingVariants = variants.filter((variant) => !deletedMessageIds.has(variant._id));
      let nextActiveAssistantMessageId: Id<"messages"> | undefined;

      if (remainingVariants.length > 0) {
        const currentActiveAssistantMessageId = userMessage.activeAssistantMessageId;
        let hasCurrentActiveAssistantMessage = false;

        if (currentActiveAssistantMessageId) {
          for (const variant of remainingVariants) {
            if (variant._id !== currentActiveAssistantMessageId) continue;
            hasCurrentActiveAssistantMessage = true;
            break;
          }
        }

        nextActiveAssistantMessageId = hasCurrentActiveAssistantMessage
          ? currentActiveAssistantMessageId
          : remainingVariants[remainingVariants.length - 1]?._id;
      }

      if (userMessage.activeAssistantMessageId === nextActiveAssistantMessageId) continue;

      userMessagePatchPayloads.push({
        userMessageId: userMessage._id,
        activeAssistantMessageId: nextActiveAssistantMessageId,
      });
      patchedActiveAssistantByUserId.set(userMessage._id, nextActiveAssistantMessageId);
    }

    for (const payload of userMessagePatchPayloads) {
      await ctx.db.patch(payload.userMessageId, {
        updatedAt: Date.now(),
        activeAssistantMessageId: payload.activeAssistantMessageId,
      });
    }

    const adjustedRemainingMessages: MessageDoc[] = [];

    for (const message of messagesToKeep) {
      if (message.role !== "user") {
        adjustedRemainingMessages.push(message);
        continue;
      }

      if (!patchedActiveAssistantByUserId.has(message._id)) {
        adjustedRemainingMessages.push(message);
        continue;
      }

      adjustedRemainingMessages.push({
        ...message,
        activeAssistantMessageId: patchedActiveAssistantByUserId.get(message._id),
      });
    }

    const remainingGraph = buildThreadMessageGraph(adjustedRemainingMessages);
    const deletedCanonicalMessages = Math.max(
      0,
      graph.canonicalMessageIds.length - remainingGraph.canonicalMessageIds.length,
    );

    const lastCanonicalMessageId =
      remainingGraph.canonicalMessageIds[remainingGraph.canonicalMessageIds.length - 1] ?? null;
    const lastRemainingMessage = lastCanonicalMessageId
      ? remainingGraph.messagesById[lastCanonicalMessageId]
      : null;

    await ctx.db.patch(args.threadId, {
      updatedAt: Date.now(),
      status: lastRemainingMessage?.status ?? "complete",
    });

    return {
      deletedMessages: deletedCanonicalMessages,
      deletedDocumentMessages: messagesToDelete.length,
      attachmentCountInDeletedRange: attachmentIdsInDeletedRange.size,
      deletedAttachments,
    };
  },
});

export const queryMessagesWithCursor = internalQuery({
  args: { cursor: v.nullable(v.string()), userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", args.userId))
      .order("asc")
      .paginate({ numItems: 100, cursor: args.cursor });
  },
});
