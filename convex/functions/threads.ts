import { v } from "convex/values";

import { internal } from "../_generated/api";
import { authenticatedMutation, authenticatedQuery } from "../components";

export const createThread = authenticatedMutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    await ctx.runMutation(internal.functions.userStats.incrementThreads, {
      userId: user.userId,
    });

    return await ctx.db.insert("threads", {
      title: args.title ?? "New Chat",
      pinned: false,
      status: "pending",
      userId: user.userId,
      updatedAt: Date.now() + 1,
      groupId: null,
      order: 0,
    });
  },
});

export const branchThread = authenticatedMutation({
  args: { threadId: v.id("threads"), lastMessageCreatedAt: v.number() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) =>
        q.eq("threadId", args.threadId).lte("_creationTime", args.lastMessageCreatedAt),
      )
      .order("asc")
      .collect();

    const newThreadId = await ctx.db.insert("threads", {
      updatedAt: Date.now() + 1,
      userId: user.userId,
      status: "complete",
      pinned: false,
      title: thread.title,
      branchedFrom: args.threadId,
      groupId: null,
      order: 0,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const { _id, _creationTime, ...message } of messages) {
      await ctx.db.insert("messages", {
        ...message,
        createdAt: Date.now(),
        updatedAt: Date.now() + 1,
        userId: user.userId,
        threadId: newThreadId,
        messageId: crypto.randomUUID(),
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
    if (!user) return [];

    const limit = args.limit ?? 200;

    // No search query: return all pinned + first N non-pinned ordered by updatedAt desc
    if (!args.query || args.query.trim() === "") {
      const pinned = await ctx.db
        .query("threads")
        .withIndex("by_userId_pinned_updatedAt", (q) =>
          q.eq("userId", user.userId).eq("pinned", true),
        )
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

export const getThreadTitle = authenticatedQuery({
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    if (!args.threadId) return { title: null };

    const thread = await ctx.db.get(args.threadId);
    if (!thread) return { title: null };
    if (thread.userId !== user.userId) return { title: null };

    return { title: thread.title };
  },
});

export const updateThreadTitle = authenticatedMutation({
  args: { threadId: v.id("threads"), title: v.string() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, { title: args.title });
  },
});

export const deleteThread = authenticatedMutation({
  args: { threadId: v.id("threads"), deleteAttachments: v.boolean() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

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
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, { pinned: args.pinned });
  },
});
