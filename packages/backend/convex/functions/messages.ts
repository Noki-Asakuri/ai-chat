import { getAll } from "convex-helpers/server/relationships";
import { v } from "convex/values";
import { hasMessageContent } from "@ai-chat/shared/chat/message-content";

import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { authenticatedMutation, authenticatedQuery, authenticatedUserIdQuery, r2 } from "../components";
import {
  AISDKMetadata,
  AISDKModelParams,
  AISDKParts,
  CURRENT_MESSAGE_GRAPH_VERSION,
  MAX_ASSISTANT_VARIANTS_PER_TURN,
  status,
} from "../schema";

type MessageDoc = Doc<"messages">;
type MessageWithAttachments = Omit<MessageDoc, "attachments"> & {
  attachments: Doc<"attachments">[];
};
type UserMessageDoc = MessageDoc & { role: "user" };
type AssistantMessageDoc = MessageDoc & { role: "assistant" };
type DeleteScope = "turnAndBelow" | "assistantVariantOnly";

const RETRY_DELETE_BATCH_SIZE = 8;
const RETRY_LEGACY_MESSAGE_LIMIT = 128;
const RETRY_ATTEMPT_STALE_MS = 2 * 60 * 1000;

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
  const reverseParentUserIdByAssistantId: Record<
    Id<"messages">,
    Id<"messages"> | null
  > = {};

  for (const userMessage of users) {
    const activeAssistantMessageId = userMessage.activeAssistantMessageId;
    if (!activeAssistantMessageId) continue;

    if (reverseParentUserIdByAssistantId[activeAssistantMessageId] === undefined) {
      reverseParentUserIdByAssistantId[activeAssistantMessageId] = userMessage._id;
      continue;
    }

    reverseParentUserIdByAssistantId[activeAssistantMessageId] = null;
  }

  for (const assistantMessage of assistants) {
    let parentUserMessageId: Id<"messages"> | null = null;

    if (assistantMessage.parentUserMessageId) {
      const parentUser = userById[assistantMessage.parentUserMessageId];
      if (parentUser) {
        parentUserMessageId = parentUser._id;
      }
    }

    if (parentUserMessageId === null) {
      parentUserMessageId = reverseParentUserIdByAssistantId[assistantMessage._id] ?? null;
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

async function buildMessagePayload(
  db: QueryCtx["db"],
  messages: MessageDoc[],
): Promise<{
  messages: MessageWithAttachments[];
  allMessages: MessageWithAttachments[];
  variantMessageIdsByUserMessageId: Record<Id<"messages">, Array<Id<"messages">>>;
}> {
  const graph = buildThreadMessageGraph(messages);
  const canonicalMessageIds = graph.canonicalMessageIds;

  const sliceUserMessageIds = new Set<Id<"messages">>();
  for (const messageId of canonicalMessageIds) {
    const message = graph.messagesById[messageId];
    if (!message) continue;

    if (message.role === "user") {
      sliceUserMessageIds.add(message._id);
      continue;
    }

    if (message.parentUserMessageId) {
      sliceUserMessageIds.add(message.parentUserMessageId);
    }
  }

  const visibleMessageIds = new Set<Id<"messages">>(canonicalMessageIds);
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
    if (message) visibleMessages.push(message);
  }

  const attachmentIdSet = new Set<Id<"attachments">>();
  for (const message of visibleMessages) {
    for (const attachmentId of message.attachments) {
      attachmentIdSet.add(attachmentId);
    }
  }

  const attachmentIds = Array.from(attachmentIdSet);
  const attachmentDocs = attachmentIds.length > 0 ? await getAll(db, attachmentIds) : [];
  const attachmentsById: Record<Id<"attachments">, Doc<"attachments">> = {};

  for (const attachmentDoc of attachmentDocs) {
    if (attachmentDoc) attachmentsById[attachmentDoc._id] = attachmentDoc;
  }

  const hydratedVisibleMessagesById: Record<Id<"messages">, MessageWithAttachments> = {};
  for (const message of visibleMessages) {
    const attachments: Doc<"attachments">[] = [];

    for (const attachmentId of message.attachments) {
      const attachment = attachmentsById[attachmentId];
      if (attachment) attachments.push(attachment);
    }

    hydratedVisibleMessagesById[message._id] = { ...message, attachments };
  }

  const allMessages: MessageWithAttachments[] = [];
  for (const message of sortMessagesAscending(visibleMessages)) {
    const hydrated = hydratedVisibleMessagesById[message._id];
    if (hydrated) allMessages.push(hydrated);
  }

  const canonicalMessages: MessageWithAttachments[] = [];
  for (const messageId of canonicalMessageIds) {
    const message = hydratedVisibleMessagesById[messageId];
    if (message) canonicalMessages.push(message);
  }

  const variantMessageIdsByUserMessageId: Record<Id<"messages">, Array<Id<"messages">>> = {};

  for (const userMessageId of sliceUserMessageIds) {
    const variants = graph.assistantsByUserId[userMessageId] ?? [];
    if (variants.length === 0) continue;

    variantMessageIdsByUserMessageId[userMessageId] = variants.map((variant) => variant._id);
  }

  return {
    messages: canonicalMessages,
    allMessages,
    variantMessageIdsByUserMessageId,
  };
}

async function expandMessagePage(db: QueryCtx["db"], pageRows: MessageDoc[]): Promise<MessageDoc[]> {
  const messagesById: Record<Id<"messages">, MessageDoc> = {};
  const userMessageIds = new Set<Id<"messages">>();

  for (const message of pageRows) {
    messagesById[message._id] = message;

    if (isUserMessage(message)) {
      userMessageIds.add(message._id);
    } else if (message.parentUserMessageId) {
      userMessageIds.add(message.parentUserMessageId);
    }
  }

  const pageMessage = pageRows[0];
  const expandedTurns = await Promise.all(
    Array.from(userMessageIds, async (userMessageId) => {
      let userMessage = messagesById[userMessageId];

      if (!userMessage) {
        const candidate = await db.get("messages", userMessageId);
        if (
          candidate &&
          pageMessage &&
          candidate.userId === pageMessage.userId &&
          candidate.threadId === pageMessage.threadId
        ) {
          userMessage = candidate;
        }
      }

      if (!userMessage) return [];

      const variants = await db
        .query("messages")
        .withIndex("by_threadId_parentUserMessageId", (q) =>
          q.eq("threadId", userMessage.threadId).eq("parentUserMessageId", userMessageId),
        )
        .take(MAX_ASSISTANT_VARIANTS_PER_TURN + 1);

      if (variants.length > MAX_ASSISTANT_VARIANTS_PER_TURN) {
        throw new Error("Assistant variant limit exceeded for migrated thread");
      }

      return [userMessage, ...variants];
    }),
  );

  for (const turnMessages of expandedTurns) {
    for (const message of turnMessages) {
      messagesById[message._id] = message;
    }
  }

  return Object.values(messagesById);
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

async function validateRetryAttachments(
  ctx: MutationCtx,
  userId: string,
  threadId: Id<"threads">,
  attachmentIds: Array<Id<"attachments">>,
): Promise<void> {
  const attachments = attachmentIds.length > 0 ? await getAll(ctx.db, attachmentIds) : [];

  for (const attachment of attachments) {
    if (!attachment) throw new Error("Attachment not found");
    if (attachment.userId !== userId) throw new Error("Not authorized to use attachment");
    if (attachment.threadId !== threadId) {
      throw new Error("Attachment is not in the retried thread");
    }
  }
}

async function finishActiveRetryAttempt(
  ctx: MutationCtx,
  threadId: Id<"threads">,
  assistantMessageId: Id<"messages">,
  status: "complete" | "failed",
  error?: string,
): Promise<void> {
  const thread = await ctx.db.get("threads", threadId);
  if (!thread?.retryAttemptId) return;

  const attempt = await ctx.db.get("retryAttempts", thread.retryAttemptId);
  if (!attempt || attempt.preparedAssistantMessageId !== assistantMessageId) return;

  await Promise.all([
    ctx.db.patch(attempt._id, { status, error, updatedAt: Date.now() }),
    ctx.db.patch(threadId, { retryAttemptId: undefined }),
  ]);
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

export const getAllMessagesFromThread = authenticatedUserIdQuery({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", ctx.userId).eq("threadId", args.threadId))
      .order("asc")
      .collect();
    return await buildMessagePayload(ctx.db, messages);
  },
});

const DEFAULT_MESSAGE_TURN_PAGE_SIZE = 5;
const MESSAGE_TURN_PAGE_SIZE_LIMIT = 5;

const attachmentValidator = v.object({
  _id: v.id("attachments"),
  _creationTime: v.number(),
  id: v.string(),
  name: v.string(),
  size: v.number(),
  type: v.union(v.literal("image"), v.literal("pdf")),
  source: v.union(v.literal("assistant"), v.literal("user")),
  mimeType: v.string(),
  path: v.string(),
  userId: v.string(),
  threadId: v.id("threads"),
});

const messageWithAttachmentsValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  threadId: v.id("threads"),
  userId: v.string(),
  messageId: v.string(),
  error: v.optional(v.string()),
  parts: AISDKParts,
  status,
  role: v.union(v.literal("assistant"), v.literal("user")),
  resumableStreamId: v.optional(v.nullable(v.string())),
  metadata: v.optional(AISDKMetadata),
  attachments: v.array(attachmentValidator),
  statsTrackedAt: v.optional(v.number()),
  parentUserMessageId: v.optional(v.id("messages")),
  activeAssistantMessageId: v.optional(v.id("messages")),
  variantIndex: v.optional(v.number()),
  messageGraphVersion: v.optional(v.number()),
  messageGraphIssue: v.optional(
    v.union(v.literal("invalidParent"), v.literal("ambiguousParent"), v.literal("variantLimit")),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const getMessagePage = authenticatedUserIdQuery({
  args: {
    threadId: v.id("threads"),
    before: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    messages: v.array(messageWithAttachmentsValidator),
    allMessages: v.array(messageWithAttachmentsValidator),
    variantMessageIdsByUserMessageId: v.record(v.id("messages"), v.array(v.id("messages"))),
    hasMore: v.boolean(),
    nextBefore: v.nullable(v.number()),
  }),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== ctx.userId) throw new Error("Not authorized");

    if (thread.messageGraphVersion !== CURRENT_MESSAGE_GRAPH_VERSION) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_userId_threadId", (q) =>
          q.eq("userId", ctx.userId).eq("threadId", args.threadId),
        )
        .order("asc")
        .collect();
      const payload = await buildMessagePayload(ctx.db, messages);

      return { ...payload, hasMore: false, nextBefore: null };
    }

    const requestedLimit = args.limit ?? DEFAULT_MESSAGE_TURN_PAGE_SIZE;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MESSAGE_TURN_PAGE_SIZE_LIMIT)
      : DEFAULT_MESSAGE_TURN_PAGE_SIZE;
    const before = args.before !== undefined && Number.isFinite(args.before) ? args.before : undefined;
    const userTurnQuery = ctx.db
      .query("messages")
      .withIndex("by_userId_threadId_role", (q) =>
        before === undefined
          ? q.eq("userId", ctx.userId).eq("threadId", args.threadId).eq("role", "user")
          : q
              .eq("userId", ctx.userId)
              .eq("threadId", args.threadId)
              .eq("role", "user")
              .lt("_creationTime", before),
      )
      .order("desc");

    const userTurns = await userTurnQuery.take(limit + 1);
    const hasMore = userTurns.length > limit;
    const pageRows = userTurns.slice(0, limit).reverse();
    const expandedPageRows = await expandMessagePage(ctx.db, pageRows);
    const payload = await buildMessagePayload(ctx.db, expandedPageRows);

    return {
      ...payload,
      hasMore,
      nextBefore: hasMore ? (pageRows[0]?._creationTime ?? null) : null,
    };
  },
});

export const getAllMessagesWithoutAttachments = authenticatedQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", user.userId).eq("threadId", args.threadId))
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

export const addAttachmentsToMessage = authenticatedMutation({
  args: {
    messageId: v.string(),
    parts: AISDKParts,
    attachmentIds: v.array(v.id("attachments")),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;

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

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    if (thread.settled === true) {
      await ctx.db.patch(args.threadId, { settled: false });
    }

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
      messageGraphVersion:
        thread.messageGraphVersion === CURRENT_MESSAGE_GRAPH_VERSION
          ? CURRENT_MESSAGE_GRAPH_VERSION
          : undefined,
      messageGraphIssue: undefined,
    });

    const assistantMessageId = await ctx.db.insert("messages", {
      ...shared,
      ...assistantMessage,
      // So that we can sort by createdAt and have the assistant message come after the user message
      createdAt: now + 1,

      parentUserMessageId: userMessageId,
      variantIndex: 0,
      activeAssistantMessageId: undefined,
      messageGraphVersion:
        thread.messageGraphVersion === CURRENT_MESSAGE_GRAPH_VERSION
          ? CURRENT_MESSAGE_GRAPH_VERSION
          : undefined,
      messageGraphIssue: undefined,
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

    await ctx.runMutation(internal.functions.userStats.incrementOnUserMessage, {
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
    retryAttemptId: v.optional(v.id("retryAttempts")),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const message = await ctx.db.get("messages", args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== user.userId) throw new Error("User not authorized");
    if (args.retryAttemptId) {
      const attempt = await ctx.db.get("retryAttempts", args.retryAttemptId);
      if (
        !attempt ||
        attempt.userId !== user.userId ||
        attempt.preparedAssistantMessageId !== message._id ||
        (attempt.status !== "prepared" && attempt.status !== "streaming")
      ) {
        return;
      }
    }

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
    await finishActiveRetryAttempt(ctx, message.threadId, message._id, "failed", args.error);
  },
});

export const getAssistantCompletionTrackingPayloadById = authenticatedQuery({
  args: { messageId: v.id("messages") },
  returns: v.union(assistantCompletionTrackingPayloadValidator, v.null()),
  handler: async (ctx, args) => {
    const user = ctx.user;

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

    await ctx.runMutation(internal.functions.userStats.incrementOnAssistantComplete, {
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

    const isAbortedCompletion = message.status === "complete" && message.metadata?.finishReason === "aborted";
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
        parts: v.any(),
        metadata: AISDKMetadata,
        attachments: v.array(v.id("attachments")),
      })
      .partial(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = ctx.user;

    const message = await ctx.db.get("messages", args.messageId);
    if (!message) throw new Error("Message not found");

    if (message.userId !== user.userId) throw new Error("User not authorized");
    if (message.status === "error") return false;
    if (message.status === "complete") return false;

    await ctx.db.patch("messages", args.messageId, {
      ...args.updates,

      status: "complete",
      updatedAt: Date.now(),
      resumableStreamId: null,
      statsTrackedAt: undefined,
    });

    await ctx.db.patch("threads", message.threadId, {
      status: "complete",
      updatedAt: Date.now(),
    });
    await finishActiveRetryAttempt(ctx, message.threadId, message._id, "complete");

    if (message.role !== "assistant") return false;

    const metadata = args.updates.metadata ?? message.metadata;
    if (!metadata) return false;
    return metadata.finishReason !== "aborted";
  },
});

export const recoverMissingStream = authenticatedMutation({
  args: {
    messageId: v.id("messages"),
    resumableStreamId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("messages", args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== ctx.user.userId) throw new Error("User not authorized");
    if (message.role !== "assistant") throw new Error("Message is not an assistant response");

    const isInFlight = message.status === "pending" || message.status === "streaming";
    if (!isInFlight || message.resumableStreamId !== args.resumableStreamId) return false;

    const parts = message.parts.map((part) => {
      if ((part.type === "text" || part.type === "reasoning") && part.state === "streaming") {
        return { ...part, state: "done" as const };
      }

      return part;
    });
    const now = Date.now();

    await ctx.db.patch(args.messageId, {
      parts,
      status: "complete",
      resumableStreamId: null,
      updatedAt: now,
      metadata: message.metadata ? { ...message.metadata, finishReason: "aborted" } : undefined,
    });
    await ctx.db.patch(message.threadId, { status: "complete", updatedAt: now });
    await finishActiveRetryAttempt(ctx, message.threadId, message._id, "complete");

    return true;
  },
});

const retryPreparationResultValidator = v.union(
  v.object({
    status: v.literal("preparing"),
    retryAttemptId: v.id("retryAttempts"),
  }),
  v.object({
    status: v.literal("prepared"),
    retryAttemptId: v.id("retryAttempts"),
    assistantMessageId: v.id("messages"),
    userMessageId: v.id("messages"),
    creationTime: v.number(),
    messageId: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    variantIndex: v.nullable(v.number()),
  }),
);

type RetryPreparationResult =
  | { status: "preparing"; retryAttemptId: Id<"retryAttempts"> }
  | {
      status: "prepared";
      retryAttemptId: Id<"retryAttempts">;
      assistantMessageId: Id<"messages">;
      userMessageId: Id<"messages">;
      creationTime: number;
      messageId: string;
      userId: string;
      createdAt: number;
      variantIndex: number | null;
    };

async function finishRetryPreparation(
  ctx: MutationCtx,
  attempt: Doc<"retryAttempts">,
  legacyGraph?: ThreadMessageGraph,
): Promise<RetryPreparationResult> {
  const thread = await ctx.db.get("threads", attempt.threadId);
  if (!thread || thread.retryAttemptId !== attempt._id) {
    throw new Error("Retry attempt is no longer active");
  }

  const targetUserMessage = await ctx.db.get("messages", attempt.userMessageId);
  if (!targetUserMessage || !isUserMessage(targetUserMessage)) {
    throw new Error("User message not found");
  }

  const variantRows = legacyGraph
    ? (legacyGraph.assistantsByUserId[targetUserMessage._id] ?? [])
    : await ctx.db
        .query("messages")
        .withIndex("by_threadId_parentUserMessageId", (q) =>
          q.eq("threadId", attempt.threadId).eq("parentUserMessageId", targetUserMessage._id),
        )
        .take(MAX_ASSISTANT_VARIANTS_PER_TURN + 1);

  const variants: AssistantMessageDoc[] = [];
  for (const variant of variantRows) {
    if (isAssistantMessage(variant)) variants.push(variant);
  }

  if (variants.length > MAX_ASSISTANT_VARIANTS_PER_TURN) {
    throw new Error("Assistant variant limit exceeded for this user turn");
  }

  let targetAssistantMessage: AssistantMessageDoc | null = null;
  if (attempt.assistantMessageId) {
    const requestedAssistantMessage = await ctx.db.get("messages", attempt.assistantMessageId);
    if (!requestedAssistantMessage) throw new Error("Assistant message not found");
    if (!isAssistantMessage(requestedAssistantMessage)) {
      throw new Error("Retry response target is invalid");
    }
    const resolvedUserMessageId = legacyGraph
      ? resolveUserMessageIdForMessage(legacyGraph, requestedAssistantMessage._id)
      : requestedAssistantMessage.parentUserMessageId;
    if (
      requestedAssistantMessage.threadId !== attempt.threadId ||
      requestedAssistantMessage.userId !== attempt.userId ||
      resolvedUserMessageId !== targetUserMessage._id
    ) {
      throw new Error("Assistant message does not belong to the retried user turn");
    }
    if (requestedAssistantMessage.messageGraphIssue !== undefined) {
      throw new Error("This legacy response must be repaired before it can be retried");
    }

    targetAssistantMessage = requestedAssistantMessage;
  } else {
    const activeAssistantMessageId = targetUserMessage.activeAssistantMessageId;
    targetAssistantMessage = variants.find((variant) => variant._id === activeAssistantMessageId) ?? null;
    if (!targetAssistantMessage) targetAssistantMessage = variants[variants.length - 1] ?? null;
  }

  const isCancelledMessage = targetAssistantMessage?.metadata?.finishReason === "aborted";
  const shouldReuseEmptyCancelledMessage =
    isCancelledMessage &&
    targetAssistantMessage !== null &&
    !hasMessageContent(targetAssistantMessage.parts, targetAssistantMessage.attachments.length);
  const shouldReuseAssistantMessage =
    targetAssistantMessage !== null &&
    (attempt.mode === "replace" ||
      targetAssistantMessage.status === "error" ||
      shouldReuseEmptyCancelledMessage);

  if (!shouldReuseAssistantMessage && variants.length >= MAX_ASSISTANT_VARIANTS_PER_TURN) {
    throw new Error("Assistant variant limit reached for this user turn");
  }

  if (attempt.userMessage) {
    await ctx.db.patch(targetUserMessage._id, {
      updatedAt: Date.now(),
      parts: attempt.userMessage.parts,
      attachments: attempt.userMessage.attachments,
    });
  }

  const now = Date.now();
  const nextMetadata = {
    durations: { request: 0, reasoning: 0, text: 0 },
    usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
    timeToFirstTokenMs: 0,
    finishReason: null,
    modelParams: attempt.modelParams,
    model: { request: attempt.model, response: null },
  };

  let assistantMessageId: Id<"messages">;
  if (shouldReuseAssistantMessage && targetAssistantMessage) {
    assistantMessageId = targetAssistantMessage._id;
    await ctx.db.patch(targetAssistantMessage._id, {
      status: "pending",
      parts: [],
      attachments: [],
      resumableStreamId: null,
      error: undefined,
      statsTrackedAt: undefined,
      updatedAt: now,
      metadata: nextMetadata,
    });
  } else {
    assistantMessageId = await ctx.db.insert("messages", {
      threadId: attempt.threadId,
      userId: attempt.userId,
      messageId: crypto.randomUUID(),
      status: "pending",
      parts: [],
      attachments: [],
      role: "assistant",
      resumableStreamId: null,
      error: undefined,
      parentUserMessageId: targetUserMessage._id,
      variantIndex: getNextVariantIndex(variants),
      activeAssistantMessageId: undefined,
      messageGraphVersion:
        thread.messageGraphVersion === CURRENT_MESSAGE_GRAPH_VERSION
          ? CURRENT_MESSAGE_GRAPH_VERSION
          : undefined,
      messageGraphIssue: undefined,
      createdAt: now,
      updatedAt: now,
      metadata: nextMetadata,
    });
  }

  await Promise.all([
    ctx.db.patch("threads", attempt.threadId, {
      settled: false,
      status: "pending",
      updatedAt: now,
    }),
    ctx.db.patch("messages", targetUserMessage._id, {
      updatedAt: now,
      activeAssistantMessageId: assistantMessageId,
    }),
    ctx.db.patch("retryAttempts", attempt._id, {
      preparedAssistantMessageId: assistantMessageId,
      status: "prepared",
      updatedAt: now,
    }),
  ]);

  await patchThreadModelConfig(ctx, attempt.threadId, attempt.model, attempt.modelParams);

  const preparedAssistantMessage = await ctx.db.get("messages", assistantMessageId);
  if (!preparedAssistantMessage || !isAssistantMessage(preparedAssistantMessage)) {
    throw new Error("Failed to prepare assistant response");
  }

  return {
    status: "prepared",
    retryAttemptId: attempt._id,
    assistantMessageId,
    userMessageId: targetUserMessage._id,
    creationTime: preparedAssistantMessage._creationTime,
    messageId: preparedAssistantMessage.messageId,
    userId: preparedAssistantMessage.userId,
    createdAt: preparedAssistantMessage.createdAt,
    variantIndex: preparedAssistantMessage.variantIndex ?? null,
  };
}

async function processLegacyRetryPreparation(
  ctx: MutationCtx,
  attempt: Doc<"retryAttempts">,
): Promise<RetryPreparationResult> {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_userId_threadId", (q) =>
      q.eq("userId", attempt.userId).eq("threadId", attempt.threadId),
    )
    .order("asc")
    .take(RETRY_LEGACY_MESSAGE_LIMIT + 1);

  if (messages.length > RETRY_LEGACY_MESSAGE_LIMIT) {
    throw new Error("This legacy thread must be migrated before retrying");
  }

  const graph = buildThreadMessageGraph(messages);
  const userTurnIndex = graph.users.findIndex((message) => message._id === attempt.userMessageId);
  if (userTurnIndex === -1) throw new Error("User turn not found");

  for (const message of collectMessagesFromUserTurnIndex(graph, userTurnIndex + 1)) {
    await ctx.db.delete(message._id);
  }

  return await finishRetryPreparation(ctx, attempt, graph);
}

async function validateModernRetryTarget(
  ctx: MutationCtx,
  threadId: Id<"threads">,
  targetUserMessage: UserMessageDoc,
  assistantMessageId: Id<"messages"> | undefined,
  mode: "createVariant" | "replace",
): Promise<void> {
  const variantRows = await ctx.db
    .query("messages")
    .withIndex("by_threadId_parentUserMessageId", (q) =>
      q.eq("threadId", threadId).eq("parentUserMessageId", targetUserMessage._id),
    )
    .take(MAX_ASSISTANT_VARIANTS_PER_TURN + 1);

  const variants: AssistantMessageDoc[] = [];
  for (const variant of variantRows) {
    if (!isAssistantMessage(variant)) continue;
    if (variant.messageGraphIssue !== undefined) {
      throw new Error("This legacy response must be repaired before it can be retried");
    }
    variants.push(variant);
  }

  if (variants.length > MAX_ASSISTANT_VARIANTS_PER_TURN) {
    throw new Error("Assistant variant limit exceeded for this user turn");
  }

  const targetAssistantMessage = assistantMessageId
    ? (variants.find((variant) => variant._id === assistantMessageId) ?? null)
    : (variants.find((variant) => variant._id === targetUserMessage.activeAssistantMessageId) ??
      variants[variants.length - 1] ??
      null);

  if (assistantMessageId && !targetAssistantMessage) {
    throw new Error("Assistant message does not belong to the retried user turn");
  }

  const isCancelledMessage = targetAssistantMessage?.metadata?.finishReason === "aborted";
  const shouldReuseEmptyCancelledMessage =
    isCancelledMessage &&
    targetAssistantMessage !== null &&
    !hasMessageContent(targetAssistantMessage.parts, targetAssistantMessage.attachments.length);
  const shouldReuseAssistantMessage =
    targetAssistantMessage !== null &&
    (mode === "replace" ||
      targetAssistantMessage.status === "error" ||
      shouldReuseEmptyCancelledMessage);

  if (!shouldReuseAssistantMessage && variants.length >= MAX_ASSISTANT_VARIANTS_PER_TURN) {
    throw new Error("Assistant variant limit reached for this user turn");
  }
}

async function processRetryDeletionBatch(
  ctx: MutationCtx,
  attempt: Doc<"retryAttempts">,
): Promise<RetryPreparationResult> {
  const targetUserMessage = await ctx.db.get("messages", attempt.userMessageId);
  if (!targetUserMessage || !isUserMessage(targetUserMessage)) {
    throw new Error("User message not found");
  }

  const thread = await ctx.db.get("threads", attempt.threadId);
  if (!thread) throw new Error("Thread not found");
  if (thread.messageGraphVersion !== CURRENT_MESSAGE_GRAPH_VERSION) {
    return await processLegacyRetryPreparation(ctx, attempt);
  }

  const sameTimestampUsers = await ctx.db
    .query("messages")
    .withIndex("by_userId_threadId_role_createdAt", (q) =>
      q
        .eq("userId", attempt.userId)
        .eq("threadId", attempt.threadId)
        .eq("role", "user")
        .eq("createdAt", targetUserMessage.createdAt)
        .gt("_creationTime", targetUserMessage._creationTime),
    )
    .take(RETRY_DELETE_BATCH_SIZE);

  const laterUsers =
    sameTimestampUsers.length > 0
      ? sameTimestampUsers
      : await ctx.db
          .query("messages")
          .withIndex("by_userId_threadId_role_createdAt", (q) =>
            q
              .eq("userId", attempt.userId)
              .eq("threadId", attempt.threadId)
              .eq("role", "user")
              .gt("createdAt", targetUserMessage.createdAt),
          )
          .take(RETRY_DELETE_BATCH_SIZE);

  if (laterUsers.length === 0) {
    return await finishRetryPreparation(ctx, attempt);
  }

  for (const userMessage of laterUsers) {
    const variants = await ctx.db
      .query("messages")
      .withIndex("by_threadId_parentUserMessageId", (q) =>
        q.eq("threadId", attempt.threadId).eq("parentUserMessageId", userMessage._id),
      )
      .take(MAX_ASSISTANT_VARIANTS_PER_TURN + 1);

    if (variants.length > MAX_ASSISTANT_VARIANTS_PER_TURN) {
      throw new Error("Assistant variant limit exceeded while preparing retry");
    }

    for (const variant of variants) {
      await ctx.db.delete(variant._id);
    }
    await ctx.db.delete(userMessage._id);
  }

  if (laterUsers.length < RETRY_DELETE_BATCH_SIZE) {
    return await finishRetryPreparation(ctx, attempt);
  }

  await ctx.db.patch(attempt._id, { updatedAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.functions.messages.continueRetryPreparation, {
    retryAttemptId: attempt._id,
  });

  return { status: "preparing", retryAttemptId: attempt._id };
}

export const prepareRetryTurn = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    userMessageId: v.id("messages"),
    assistantMessageId: v.optional(v.id("messages")),
    mode: v.union(v.literal("createVariant"), v.literal("replace")),

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
  returns: retryPreparationResultValidator,
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");
    if (thread.retryAttemptId) {
      const activeAttempt = await ctx.db.get("retryAttempts", thread.retryAttemptId);
      const isStale =
        activeAttempt &&
        (activeAttempt.status === "deleting" || activeAttempt.status === "prepared") &&
        Date.now() - activeAttempt.updatedAt >= RETRY_ATTEMPT_STALE_MS;

      if (!activeAttempt || activeAttempt.status === "complete" || activeAttempt.status === "failed" || activeAttempt.status === "cancelled") {
        await ctx.db.patch(args.threadId, { retryAttemptId: undefined });
      } else if (isStale) {
        const preparedMessage = activeAttempt.preparedAssistantMessageId
          ? await ctx.db.get("messages", activeAttempt.preparedAssistantMessageId)
          : null;
        if (preparedMessage?.resumableStreamId) {
          throw new Error("A retry is already in progress");
        }
        if (preparedMessage) {
          await ctx.db.patch(preparedMessage._id, {
            status: "error",
            error: "Retry expired before generation started",
            updatedAt: Date.now(),
          });
        }
        await ctx.db.patch(activeAttempt._id, {
          status: "failed",
          error: "Retry expired before generation started",
          updatedAt: Date.now(),
        });
        await ctx.db.patch(args.threadId, {
          retryAttemptId: undefined,
          status: "complete",
          updatedAt: Date.now(),
        });
      } else {
        throw new Error("A retry is already in progress");
      }
    }
    if (thread.status === "pending" || thread.status === "streaming") {
      throw new Error("Cannot retry while a response is in progress");
    }

    const targetUserMessage = await ctx.db.get("messages", args.userMessageId);
    if (!targetUserMessage) throw new Error("User message not found");
    if (targetUserMessage.userId !== user.userId) throw new Error("Not authorized");
    if (targetUserMessage.threadId !== args.threadId) throw new Error("User message is not in thread");
    if (!isUserMessage(targetUserMessage)) throw new Error("Retry target must be a user message");
    if (targetUserMessage.messageGraphIssue !== undefined) {
      throw new Error("This legacy user turn must be repaired before it can be retried");
    }

    if (args.userMessage) {
      if (args.userMessage.messageId !== targetUserMessage._id) {
        throw new Error("Edited message must match the retried user turn");
      }
      await validateRetryAttachments(
        ctx,
        user.userId,
        args.threadId,
        args.userMessage.attachments,
      );
    }

    if (args.assistantMessageId) {
      const requestedAssistantMessage = await ctx.db.get("messages", args.assistantMessageId);
      if (!requestedAssistantMessage) throw new Error("Assistant message not found");
      if (!isAssistantMessage(requestedAssistantMessage)) {
        throw new Error("Retry response target is invalid");
      }
      if (requestedAssistantMessage.userId !== user.userId || requestedAssistantMessage.threadId !== args.threadId) {
        throw new Error("Assistant message does not belong to the retried user turn");
      }
      if (
        thread.messageGraphVersion === CURRENT_MESSAGE_GRAPH_VERSION &&
        requestedAssistantMessage.parentUserMessageId !== targetUserMessage._id
      ) {
        throw new Error("Assistant message does not belong to the retried user turn");
      }
    }

    if (thread.messageGraphVersion === CURRENT_MESSAGE_GRAPH_VERSION) {
      await validateModernRetryTarget(
        ctx,
        args.threadId,
        targetUserMessage,
        args.assistantMessageId,
        args.mode,
      );
    }

    const now = Date.now();
    const retryAttemptId = await ctx.db.insert("retryAttempts", {
      threadId: args.threadId,
      userId: user.userId,
      userMessageId: targetUserMessage._id,
      assistantMessageId: args.assistantMessageId,
      mode: args.mode,
      model: args.model,
      modelParams: args.modelParams,
      userMessage: args.userMessage,
      status: "deleting",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.threadId, { retryAttemptId, updatedAt: now });
    await ctx.scheduler.runAfter(RETRY_ATTEMPT_STALE_MS, internal.functions.messages.cleanupRetryAttempt, {
      retryAttemptId,
    });

    const attempt = await ctx.db.get("retryAttempts", retryAttemptId);
    if (!attempt) throw new Error("Failed to create retry attempt");

    try {
      return await processRetryDeletionBatch(ctx, attempt);
    } catch (error) {
      await ctx.db.delete(retryAttemptId);
      await ctx.db.patch(args.threadId, { retryAttemptId: undefined });
      throw error;
    }
  },
});

export const continueRetryPreparation = internalMutation({
  args: { retryAttemptId: v.id("retryAttempts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get("retryAttempts", args.retryAttemptId);
    if (!attempt || attempt.status !== "deleting") return null;

    const thread = await ctx.db.get("threads", attempt.threadId);
    if (!thread || thread.retryAttemptId !== attempt._id) return null;

    try {
      await processRetryDeletionBatch(ctx, attempt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to prepare retry";
      await ctx.db.patch(attempt._id, { status: "failed", error: message, updatedAt: Date.now() });
      const thread = await ctx.db.get("threads", attempt.threadId);
      if (thread?.retryAttemptId === attempt._id) {
        await ctx.db.patch(attempt.threadId, {
          retryAttemptId: undefined,
          status: "complete",
          updatedAt: Date.now(),
        });
      }
    }

    return null;
  },
});

export const getRetryAttempt = authenticatedQuery({
  args: { retryAttemptId: v.id("retryAttempts") },
  returns: v.union(
    retryPreparationResultValidator,
    v.object({ status: v.literal("failed"), error: v.string() }),
    v.object({ status: v.literal("cancelled") }),
  ),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get("retryAttempts", args.retryAttemptId);
    if (!attempt) throw new Error("Retry attempt not found");
    if (attempt.userId !== ctx.user.userId) throw new Error("Not authorized");

    if (attempt.status === "failed") {
      return { status: "failed" as const, error: attempt.error ?? "Failed to prepare retry" };
    }
    if (attempt.status === "cancelled") return { status: "cancelled" as const };
    if (attempt.status === "deleting") {
      return { status: "preparing" as const, retryAttemptId: attempt._id };
    }
    if (!attempt.preparedAssistantMessageId) {
      throw new Error("Prepared retry is missing its assistant response");
    }

    const preparedAssistantMessage = await ctx.db.get(
      "messages",
      attempt.preparedAssistantMessageId,
    );
    if (!preparedAssistantMessage || !isAssistantMessage(preparedAssistantMessage)) {
      throw new Error("Prepared assistant response not found");
    }

    return {
      status: "prepared" as const,
      retryAttemptId: attempt._id,
      assistantMessageId: preparedAssistantMessage._id,
      userMessageId: attempt.userMessageId,
      creationTime: preparedAssistantMessage._creationTime,
      messageId: preparedAssistantMessage.messageId,
      userId: preparedAssistantMessage.userId,
      createdAt: preparedAssistantMessage.createdAt,
      variantIndex: preparedAssistantMessage.variantIndex ?? null,
    };
  },
});

export const markRetryAttemptStreaming = authenticatedMutation({
  args: {
    retryAttemptId: v.id("retryAttempts"),
    assistantMessageId: v.id("messages"),
    resumableStreamId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get("retryAttempts", args.retryAttemptId);
    if (!attempt) return false;
    if (attempt.userId !== ctx.user.userId) throw new Error("Not authorized");
    if (attempt.status !== "prepared") return false;
    if (attempt.preparedAssistantMessageId !== args.assistantMessageId) return false;

    const message = await ctx.db.get("messages", args.assistantMessageId);
    if (!message || message.userId !== ctx.user.userId || message.threadId !== attempt.threadId) {
      return false;
    }

    const now = Date.now();
    await Promise.all([
      ctx.db.patch(attempt._id, { status: "streaming", updatedAt: now }),
      ctx.db.patch(message._id, {
        status: "streaming",
        resumableStreamId: args.resumableStreamId,
        updatedAt: now,
      }),
      ctx.db.patch(attempt.threadId, { status: "streaming", updatedAt: now }),
    ]);
    return true;
  },
});

export const cancelRetryAttempt = authenticatedMutation({
  args: {
    retryAttemptId: v.id("retryAttempts"),
    reason: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get("retryAttempts", args.retryAttemptId);
    if (!attempt) return false;
    if (attempt.userId !== ctx.user.userId) throw new Error("Not authorized");
    if (attempt.status !== "deleting" && attempt.status !== "prepared") return false;

    const now = Date.now();
    const preparedMessage = attempt.preparedAssistantMessageId
      ? await ctx.db.get("messages", attempt.preparedAssistantMessageId)
      : null;
    if (
      preparedMessage &&
      (preparedMessage.status === "pending" || preparedMessage.status === "streaming") &&
      !preparedMessage.resumableStreamId
    ) {
      await ctx.db.patch(preparedMessage._id, {
        status: "error",
        error: args.reason ?? "Retry cancelled before generation started",
        resumableStreamId: null,
        updatedAt: now,
      });
    }

    const thread = await ctx.db.get("threads", attempt.threadId);
    await ctx.db.patch(attempt._id, {
      status: "cancelled",
      error: args.reason,
      updatedAt: now,
    });
    if (thread?.retryAttemptId === attempt._id) {
      await ctx.db.patch(attempt.threadId, {
        retryAttemptId: undefined,
        status: "complete",
        updatedAt: now,
      });
    }

    return true;
  },
});

export const cleanupRetryAttempt = internalMutation({
  args: { retryAttemptId: v.id("retryAttempts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get("retryAttempts", args.retryAttemptId);
    if (!attempt) return null;
    if (attempt.status !== "deleting" && attempt.status !== "prepared") return null;
    const remainingStaleMs = RETRY_ATTEMPT_STALE_MS - (Date.now() - attempt.updatedAt);
    if (remainingStaleMs > 0) {
      await ctx.scheduler.runAfter(remainingStaleMs, internal.functions.messages.cleanupRetryAttempt, {
        retryAttemptId: attempt._id,
      });
      return null;
    }

    const now = Date.now();
    const preparedMessage = attempt.preparedAssistantMessageId
      ? await ctx.db.get("messages", attempt.preparedAssistantMessageId)
      : null;
    if (preparedMessage?.resumableStreamId) {
      await ctx.db.patch(attempt._id, { status: "streaming", updatedAt: Date.now() });
      return null;
    }
    if (
      preparedMessage &&
      (preparedMessage.status === "pending" || preparedMessage.status === "streaming") &&
      !preparedMessage.resumableStreamId
    ) {
      await ctx.db.patch(preparedMessage._id, {
        status: "error",
        error: "Retry expired before generation started",
        resumableStreamId: null,
        updatedAt: now,
      });
    }

    const thread = await ctx.db.get("threads", attempt.threadId);
    await ctx.db.patch(attempt._id, {
      status: "failed",
      error: "Retry expired before generation started",
      updatedAt: now,
    });
    if (thread?.retryAttemptId === attempt._id) {
      await ctx.db.patch(attempt.threadId, {
        retryAttemptId: undefined,
        status: "complete",
        updatedAt: now,
      });
    }
    return null;
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

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const userMessage = await ctx.db.get("messages", args.userMessageId);
    if (!userMessage) throw new Error("User message not found");
    if (userMessage.role !== "user") throw new Error("Target user message is invalid");
    if (userMessage.threadId !== args.threadId) throw new Error("User message is not in thread");

    const assistantMessage = await ctx.db.get("messages", args.assistantMessageId);
    if (!assistantMessage) throw new Error("Assistant message not found");
    if (assistantMessage.role !== "assistant") throw new Error("Target assistant message is invalid");
    if (assistantMessage.threadId !== args.threadId) {
      throw new Error("Assistant message is not in thread");
    }

    let resolvedUserMessageId = assistantMessage.parentUserMessageId ?? null;

    if (!resolvedUserMessageId) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_userId_threadId", (q) => q.eq("userId", user.userId).eq("threadId", args.threadId))
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

    const deleteScope: DeleteScope = args.deleteScope ?? "turnAndBelow";

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");
    if (thread.status === "pending" || thread.status === "streaming") {
      throw new Error("Cannot delete messages while streaming");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", user.userId).eq("threadId", args.threadId))
      .order("asc")
      .collect();

    const graph = buildThreadMessageGraph(messages);
    const targetMessage = graph.messagesById[args.messageId];
    if (!targetMessage) throw new Error("Message not found");

    const targetUserMessageId = resolveUserMessageIdForMessage(graph, args.messageId);
    if (!targetUserMessageId) throw new Error("Failed to resolve target user turn");

    const targetUserTurnIndex = graph.users.findIndex((message) => message._id === targetUserMessageId);
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

    const remainingUserMessages = graph.users.filter((message) => !deletedMessageIds.has(message._id));

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

    if (deleteScope === "assistantVariantOnly") {
      const remainingTargetVariants = (graph.assistantsByUserId[targetUserMessageId] ?? []).filter(
        (variant) => !deletedMessageIds.has(variant._id),
      );

      for (let variantIndex = 0; variantIndex < remainingTargetVariants.length; variantIndex += 1) {
        const variant = remainingTargetVariants[variantIndex];
        if (!variant || variant.variantIndex === variantIndex) continue;

        await ctx.db.patch(variant._id, { variantIndex });
      }
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
