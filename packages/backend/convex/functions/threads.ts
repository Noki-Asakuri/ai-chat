import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";

import { authenticatedMutation, authenticatedQuery, authenticatedUserIdQuery } from "../components";
import {
  AISDKModelParams,
  CURRENT_MESSAGE_GRAPH_VERSION,
  MAX_ASSISTANT_VARIANTS_PER_TURN,
  status,
} from "../schema";

type ThreadStatus = "pending" | "streaming" | "complete" | "error";

type AccountThreadRow = {
  _id: Id<"threads">;
  _creationTime: number;

  title: string;
  updatedAt: number;
  pinned: boolean;
  shared: boolean;
  status: ThreadStatus;

  messageCount: number;
  attachmentCount: number;
};

type AccountThreadSortField =
  | "title"
  | "pinned"
  | "shared"
  | "messageCount"
  | "attachmentCount"
  | "_creationTime"
  | "updatedAt"
  | "status";

type AccountThreadSortDirection = "asc" | "desc";

const MAX_ACCOUNT_THREADS_PAGE_SIZE = 15;
const SETTLE_INACTIVE_THREADS_PAGE_SIZE = 100;

function serializeThread(thread: Doc<"threads">) {
  return {
    _id: thread._id,
    _creationTime: thread._creationTime,
    title: thread.title,
    userId: thread.userId,
    updatedAt: thread.updatedAt,
    lastViewedAt: thread.lastViewedAt,
    pinned: thread.pinned,
    settled: thread.settled,
    branchedFrom: thread.branchedFrom,
    latestModel: thread.latestModel,
    latestModelParams: thread.latestModelParams,
    groupId: thread.groupId,
    status: thread.status,
  };
}

const threadValidator = v.object({
  _id: v.id("threads"),
  _creationTime: v.number(),
  title: v.string(),
  userId: v.string(),
  updatedAt: v.number(),
  lastViewedAt: v.optional(v.number()),
  pinned: v.boolean(),
  settled: v.optional(v.boolean()),
  branchedFrom: v.optional(v.id("threads")),
  latestModel: v.string(),
  latestModelParams: AISDKModelParams,
  groupId: v.nullable(v.id("groups")),
  status,
});

function compareAccountThreadRows(
  left: AccountThreadRow,
  right: AccountThreadRow,
  sortField: AccountThreadSortField,
  sortDirection: AccountThreadSortDirection,
): number {
  let base = 0;

  if (sortField === "title") {
    base = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  }

  if (sortField === "messageCount") {
    if (left.messageCount < right.messageCount) base = -1;
    else if (left.messageCount > right.messageCount) base = 1;
  }

  if (sortField === "pinned") {
    if (left.pinned === right.pinned) base = 0;
    else if (left.pinned) base = 1;
    else base = -1;
  }

  if (sortField === "shared") {
    if (left.shared === right.shared) base = 0;
    else if (left.shared) base = 1;
    else base = -1;
  }

  if (sortField === "attachmentCount") {
    if (left.attachmentCount < right.attachmentCount) base = -1;
    else if (left.attachmentCount > right.attachmentCount) base = 1;
  }

  if (sortField === "_creationTime") {
    if (left._creationTime < right._creationTime) base = -1;
    else if (left._creationTime > right._creationTime) base = 1;
  }

  if (sortField === "updatedAt") {
    if (left.updatedAt < right.updatedAt) base = -1;
    else if (left.updatedAt > right.updatedAt) base = 1;
  }

  if (sortField === "status") {
    base = left.status.localeCompare(right.status);
  }

  if (base === 0) {
    if (left.updatedAt < right.updatedAt) base = -1;
    else if (left.updatedAt > right.updatedAt) base = 1;
  }

  if (sortDirection === "desc") return base * -1;
  return base;
}

export const createThread = authenticatedMutation({
  args: {
    title: v.optional(v.string()),
    groupId: v.nullable(v.id("groups")),

    latestModel: v.string(),
    latestModelParams: AISDKModelParams,
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    const now = Date.now();

    if (args.groupId) {
      const group = await ctx.db.get("groups", args.groupId);
      if (!group) throw new Error("Group not found");
      if (group.userId !== user.userId) throw new Error("Not authorized");
    }

    await ctx.runMutation(internal.functions.userStats.incrementThreads, {
      userId: user.userId,
    });

    return await ctx.db.insert("threads", {
      title: args.title ?? "New Chat",
      pinned: false,
      settled: false,
      messageGraphVersion: CURRENT_MESSAGE_GRAPH_VERSION,
      status: "pending",
      userId: user.userId,
      updatedAt: now + 1,
      lastViewedAt: now,
      groupId: args.groupId,

      latestModel: args.latestModel,
      latestModelParams: args.latestModelParams,
    });
  },
});

export const updateThreadModelConfig = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    latestModel: v.string(),
    latestModelParams: AISDKModelParams,
  },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    if (
      thread.latestModel === args.latestModel &&
      thread.latestModelParams?.effort === args.latestModelParams.effort &&
      thread.latestModelParams?.webSearch === args.latestModelParams.webSearch &&
      thread.latestModelParams?.profile === args.latestModelParams.profile
    ) {
      return;
    }

    await ctx.db.patch(args.threadId, {
      latestModel: args.latestModel,
      latestModelParams: args.latestModelParams,
    });
  },
});

export const branchThread = authenticatedMutation({
  args: { threadId: v.id("threads"), assistantMessageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = ctx.user;
    const now = Date.now();

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const lastMessage = await ctx.db.get("messages", args.assistantMessageId);
    if (!lastMessage) throw new Error("Message not found");
    if (lastMessage.userId !== user.userId) throw new Error("Not authorized");
    if (lastMessage.threadId !== args.threadId) throw new Error("Message is not in thread");
    if (lastMessage.role !== "assistant") throw new Error("Message is not an assistant response");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) =>
        q.eq("threadId", args.threadId).lte("_creationTime", lastMessage._creationTime),
      )
      .order("asc")
      .collect();

    const newThreadId = await ctx.db.insert("threads", {
      updatedAt: now + 1,
      lastViewedAt: now + 1,
      userId: user.userId,
      status: "complete",
      pinned: false,
      settled: false,
      title: thread.title,
      branchedFrom: args.threadId,
      groupId: null,
      latestModel: thread.latestModel,
      latestModelParams: thread.latestModelParams,
    });

    const copiedMessageIds = new Map<Id<"messages">, Id<"messages">>();
    const sourceMessagesById = new Map(messages.map((message) => [message._id, message]));
    const copiedAssistantsByUserId = new Map<Id<"messages">, Doc<"messages">[]>();
    const variantIndexesByUserId = new Map<Id<"messages">, number[]>();
    let hasCompleteMessageGraph = true;

    for (const message of messages) {
      if (message.threadId !== args.threadId || message.userId !== user.userId) {
        throw new Error("Thread contains an invalid message owner");
      }
      if (message.messageGraphIssue !== undefined) {
        hasCompleteMessageGraph = false;
      }

      if (message.role === "user") {
        if (message.parentUserMessageId !== undefined || message.variantIndex !== undefined) {
          hasCompleteMessageGraph = false;
        }

        if (message.activeAssistantMessageId) {
          const activeAssistant = sourceMessagesById.get(message.activeAssistantMessageId);
          if (activeAssistant && activeAssistant.parentUserMessageId !== message._id) {
            hasCompleteMessageGraph = false;
          }
        }
        continue;
      }

      const parentMessage = message.parentUserMessageId
        ? sourceMessagesById.get(message.parentUserMessageId)
        : undefined;
      if (parentMessage?.role !== "user" || message.variantIndex === undefined) {
        hasCompleteMessageGraph = false;
        continue;
      }

      const variantIndexes = variantIndexesByUserId.get(parentMessage._id) ?? [];
      variantIndexes.push(message.variantIndex);
      variantIndexesByUserId.set(parentMessage._id, variantIndexes);

      const copiedAssistants = copiedAssistantsByUserId.get(parentMessage._id) ?? [];
      copiedAssistants.push(message);
      copiedAssistantsByUserId.set(parentMessage._id, copiedAssistants);
    }

    for (const variantIndexes of variantIndexesByUserId.values()) {
      if (variantIndexes.length > MAX_ASSISTANT_VARIANTS_PER_TURN) {
        hasCompleteMessageGraph = false;
        continue;
      }

      variantIndexes.sort((left, right) => left - right);
      for (let index = 0; index < variantIndexes.length; index += 1) {
        if (variantIndexes[index] !== index) hasCompleteMessageGraph = false;
      }
    }

    for (const {
      _id,
      _creationTime,
      parentUserMessageId: _parentUserMessageId,
      activeAssistantMessageId: _activeAssistantMessageId,
      messageGraphVersion: _messageGraphVersion,
      ...message
    } of messages) {
      const copiedMessageId = await ctx.db.insert("messages", {
        ...message,

        userId: user.userId,
        threadId: newThreadId,
        messageId: crypto.randomUUID(),

        parentUserMessageId: undefined,
        activeAssistantMessageId: undefined,
        messageGraphVersion: hasCompleteMessageGraph
          ? CURRENT_MESSAGE_GRAPH_VERSION
          : undefined,
        messageGraphIssue: message.messageGraphIssue,

        createdAt: Date.now() + 1,
        updatedAt: Date.now() + 2,
      });

      copiedMessageIds.set(_id, copiedMessageId);
    }

    for (const message of messages) {
      const copiedMessageId = copiedMessageIds.get(message._id);
      if (!copiedMessageId) continue;

      if (message.role === "assistant") {
        const parentMessage = message.parentUserMessageId
          ? sourceMessagesById.get(message.parentUserMessageId)
          : undefined;
        const copiedParentId =
          parentMessage?.role === "user" &&
          parentMessage.threadId === args.threadId &&
          parentMessage.userId === user.userId
            ? copiedMessageIds.get(parentMessage._id)
            : undefined;

        if (!copiedParentId) {
          hasCompleteMessageGraph = false;
          continue;
        }

        await ctx.db.patch(copiedMessageId, { parentUserMessageId: copiedParentId });
        continue;
      }

      const activeAssistant = message.activeAssistantMessageId
        ? sourceMessagesById.get(message.activeAssistantMessageId)
        : undefined;
      const copiedActiveAssistantId =
        activeAssistant?.role === "assistant" &&
        activeAssistant.threadId === args.threadId &&
        activeAssistant.userId === user.userId &&
        activeAssistant.parentUserMessageId === message._id
          ? copiedMessageIds.get(activeAssistant._id)
          : undefined;

      const copiedAssistants = copiedAssistantsByUserId.get(message._id) ?? [];
      const copiedFallbackAssistantId = copiedAssistants[copiedAssistants.length - 1]?._id;
      const nextActiveAssistantId =
        copiedActiveAssistantId ??
        (copiedFallbackAssistantId ? copiedMessageIds.get(copiedFallbackAssistantId) : undefined);

      if (nextActiveAssistantId) {
        await ctx.db.patch(copiedMessageId, {
          activeAssistantMessageId: nextActiveAssistantId,
        });
      }
    }

    if (hasCompleteMessageGraph) {
      await ctx.db.patch(newThreadId, {
        messageGraphVersion: CURRENT_MESSAGE_GRAPH_VERSION,
      });
    }

    return newThreadId;
  },
});

export const getAllThreads = authenticatedQuery({
  args: {
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const limit = args.limit ?? 200;

    // No search query: return all pinned + first N non-pinned ordered by updatedAt desc
    if (!args.query || args.query.trim() === "") {
      const pinned = await ctx.db
        .query("threads")
        .withIndex("by_userId_pinned_updatedAt", (q) => q.eq("userId", user.userId).eq("pinned", true))
        .order("desc")
        .collect();

      const nonPinned = await ctx.db
        .query("threads")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", user.userId))
        .order("desc")
        .filter((q) => q.neq(q.field("pinned"), true))
        .take(limit);

      return [...pinned, ...nonPinned].map((thread) => ({
        ...thread,
        pinned: thread.pinned ?? false,
      }));
    }

    // With search query: include only pinned that match + up to N non-pinned that match
    const search = args.query.trim();

    const pinnedMatches = await ctx.db
      .query("threads")
      .withSearchIndex("search_title", (q) =>
        q.search("title", search).eq("userId", user.userId).eq("pinned", true),
      )
      .take(1024);

    const nonPinnedMatches = await ctx.db
      .query("threads")
      .withSearchIndex("search_title", (q) => q.search("title", search).eq("userId", user.userId))
      .filter((q) => q.neq(q.field("pinned"), true))
      .take(limit);

    return [...pinnedMatches, ...nonPinnedMatches];
  },
});

export const listSettledThreads = authenticatedQuery({
  args: {
    groupId: v.nullable(v.id("groups")),
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(threadValidator),
  handler: async (ctx, args) => {
    const user = ctx.user;
    const search = args.query.trim();

    if (search.length > 0) {
      const result = await ctx.db
        .query("threads")
        .withSearchIndex("search_title_by_userId_settled_groupId", (q) =>
          q.search("title", search).eq("userId", user.userId).eq("settled", true).eq("groupId", args.groupId),
        )
        .paginate(args.paginationOpts);

      return { ...result, page: result.page.map(serializeThread) };
    }

    const result = await ctx.db
      .query("threads")
      .withIndex("by_userId_settled_groupId_updatedAt", (q) =>
        q.eq("userId", user.userId).eq("settled", true).eq("groupId", args.groupId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return { ...result, page: result.page.map(serializeThread) };
  },
});

export const markThreadViewed = authenticatedMutation({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.user;
    const thread = await ctx.db.get("threads", args.threadId);

    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, {
      lastViewedAt: Math.max(Date.now(), thread.updatedAt),
    });

    return null;
  },
});

export const listAccountThreads = authenticatedQuery({
  args: {
    query: v.optional(v.string()),
    sortField: v.union(
      v.literal("title"),
      v.literal("pinned"),
      v.literal("shared"),
      v.literal("messageCount"),
      v.literal("attachmentCount"),
      v.literal("_creationTime"),
      v.literal("updatedAt"),
      v.literal("status"),
    ),
    sortDirection: v.union(v.literal("asc"), v.literal("desc")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("threads"),
        _creationTime: v.number(),

        title: v.string(),
        updatedAt: v.number(),
        pinned: v.boolean(),
        shared: v.boolean(),
        status: status,

        messageCount: v.number(),
        attachmentCount: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = ctx.user;
    const userId = user.userId;

    const search = (args.query ?? "").trim();
    const sortField = args.sortField;
    const sortDirection = args.sortDirection;
    const paginationOpts = {
      numItems: Math.min(args.paginationOpts.numItems, MAX_ACCOUNT_THREADS_PAGE_SIZE),
      cursor: args.paginationOpts.cursor,
    };

    const canUseUpdatedAtIndexSort = search.length === 0 && sortField === "updatedAt";

    const pageResult =
      search.length === 0
        ? canUseUpdatedAtIndexSort
          ? await ctx.db
              .query("threads")
              .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
              .order(sortDirection)
              .paginate(paginationOpts)
          : await ctx.db
              .query("threads")
              .withIndex("by_userId_pinned_updatedAt", (q) => q.eq("userId", userId))
              .order("desc")
              .paginate(paginationOpts)
        : await ctx.db
            .query("threads")
            .withSearchIndex("search_title", (q) => q.search("title", search).eq("userId", userId))
            .paginate(paginationOpts);

    const rows: Array<AccountThreadRow> = [];

    for (const thread of pageResult.page) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_userId_threadId", (q) => q.eq("userId", userId).eq("threadId", thread._id))
        .collect();

      const attachments = await ctx.db
        .query("attachments")
        .withIndex("by_userId_threadId", (q) => q.eq("userId", userId).eq("threadId", thread._id))
        .collect();

      const threadShare = await ctx.db
        .query("threadShares")
        .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
        .unique();

      rows.push({
        _id: thread._id,
        _creationTime: thread._creationTime,

        title: thread.title,
        updatedAt: thread.updatedAt,
        pinned: thread.pinned,
        shared: threadShare !== null,
        status: thread.status,

        messageCount: messages.length,
        attachmentCount: attachments.length,
      });
    }

    rows.sort(function (left, right) {
      return compareAccountThreadRows(left, right, sortField, sortDirection);
    });

    return {
      page: rows,
      isDone: pageResult.isDone,
      continueCursor: pageResult.continueCursor,
    };
  },
});

export const getThreadTitle = authenticatedQuery({
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!args.threadId) {
      return {
        title: null,
        groupId: null,
        groupTitle: null,
        pinned: false,
        settled: false,
        isShared: false,
      };
    }

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) {
      return {
        title: null,
        groupId: null,
        groupTitle: null,
        pinned: false,
        settled: false,
        isShared: false,
      };
    }
    if (thread.userId !== user.userId) {
      return {
        title: null,
        groupId: null,
        groupTitle: null,
        pinned: false,
        settled: false,
        isShared: false,
      };
    }

    const [group, threadShare] = await Promise.all([
      thread.groupId ? ctx.db.get("groups", thread.groupId) : null,
      ctx.db
        .query("threadShares")
        .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
        .unique(),
    ]);

    return {
      title: thread.title,
      groupId: group?.userId === user.userId ? group._id : null,
      groupTitle: group?.userId === user.userId ? group.title : null,
      pinned: thread.pinned,
      settled: thread.settled === true,
      isShared: threadShare !== null,
    };
  },
});

export const getThreadPageMeta = authenticatedUserIdQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== ctx.userId) throw new Error("Not authorized");

    const [group, threadShare] = await Promise.all([
      thread.groupId ? ctx.db.get("groups", thread.groupId) : null,
      ctx.db
        .query("threadShares")
        .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
        .unique(),
    ]);

    return {
      title: thread.title,
      groupId: group?.userId === ctx.userId ? group._id : null,
      groupTitle: group?.userId === ctx.userId ? group.title : null,
      pinned: thread.pinned,
      settled: thread.settled === true,
      isShared: threadShare !== null,
      status: thread.status,
      updatedAt: thread.updatedAt,
      lastViewedAt: thread.lastViewedAt ?? null,
      latestModel: thread.latestModel,
      latestModelParams: thread.latestModelParams,
    };
  },
});

export const updateThreadTitle = authenticatedMutation({
  args: { threadId: v.id("threads"), title: v.string() },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, { title: args.title });
  },
});

export const deleteThread = authenticatedMutation({
  args: { threadId: v.id("threads"), deleteAttachments: v.boolean() },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");
    if (thread.status === "pending" || thread.status === "streaming") {
      throw new Error("Cannot delete a thread while it is streaming");
    }

    await ctx.db.delete(args.threadId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    if (args.deleteAttachments) {
      const attachments = messages
        .map((message) => message.attachments ?? [])
        .flat()
        .filter(Boolean);

      for (const attachmentId of attachments) {
        await ctx.db.delete(attachmentId);
      }
    }
  },
});

export const pinThread = authenticatedMutation({
  args: { threadId: v.id("threads"), pinned: v.boolean() },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, { pinned: args.pinned });
  },
});

export const settleThread = authenticatedMutation({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");
    if (thread.status !== "complete" && thread.status !== "error") {
      throw new Error("Only completed or failed threads can be settled");
    }

    await ctx.db.patch(args.threadId, { pinned: false, settled: true });
    return null;
  },
});

export const settleInactiveThreads = authenticatedMutation({
  args: {
    before: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    settledCount: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = ctx.user;
    const pageResult = await ctx.db
      .query("threads")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", user.userId).lte("updatedAt", args.before))
      .paginate({
        numItems: SETTLE_INACTIVE_THREADS_PAGE_SIZE,
        cursor: args.cursor,
      });

    let settledCount = 0;

    for (const thread of pageResult.page) {
      if (thread.settled !== true && (thread.status === "complete" || thread.status === "error")) {
        await ctx.db.patch(thread._id, { pinned: false, settled: true });
        settledCount += 1;
      }
    }

    return {
      settledCount,
      isDone: pageResult.isDone,
      continueCursor: pageResult.isDone ? null : pageResult.continueCursor,
    };
  },
});

export const unsettleThread = authenticatedMutation({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, { settled: false });
    return null;
  },
});

export const getThreadTitleWithoutSession = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return { title: null, pinned: false, isShared: false };

    const threadShare = await ctx.db
      .query("threadShares")
      .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
      .unique();

    return { title: thread.title, pinned: thread.pinned, isShared: threadShare !== null };
  },
});
