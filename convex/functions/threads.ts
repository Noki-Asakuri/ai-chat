import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const createThread = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("threads", {
      updatedAt: Date.now() + 1,
      userId: user.subject,
      title: args.title ?? "New Chat",
    });
  },
});

export const branchThread = mutation({
  args: { threadId: v.id("threads"), lastMessageCreatedAt: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) =>
        q.eq("threadId", args.threadId).lte("_creationTime", args.lastMessageCreatedAt),
      )
      .order("asc")
      .collect();

    const newThreadId = await ctx.db.insert("threads", {
      updatedAt: Date.now() + 1,
      userId: user.subject,
      title: thread.title,
      branchedFrom: args.threadId,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const { _id, _creationTime, ...message } of messages) {
      await ctx.db.insert("messages", {
        ...message,
        createdAt: Date.now(),
        updatedAt: Date.now() + 1,
        userId: user.subject,
        threadId: newThreadId,
        messageId: crypto.randomUUID(),
      });
    }

    return newThreadId;
  },
});

export const getAllThreads = query({
  args: {
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return [];

    const limit = args.limit ?? 200;

    // No search query: return all pinned + first N non-pinned ordered by updatedAt desc
    if (!args.query || args.query.trim() === "") {
      const pinned = await ctx.db
        .query("threads")
        .withIndex("by_userId_pinned_updatedAt", (q) =>
          q.eq("userId", user.subject).eq("pinned", true),
        )
        .order("desc")
        .collect();

      const nonPinned = await ctx.db
        .query("threads")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", user.subject))
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
        q.search("title", search).eq("userId", user.subject).eq("pinned", true),
      )
      .take(1024);

    const nonPinnedMatches = await ctx.db
      .query("threads")
      .withSearchIndex("search_title", (q) => q.search("title", search).eq("userId", user.subject))
      .filter((q) => q.neq(q.field("pinned"), true))
      .take(limit);

    return [...pinnedMatches, ...nonPinnedMatches].map((thread) => ({
      ...thread,
      pinned: thread.pinned ?? false,
    }));
  },
});

export const updateThreadTitle = mutation({
  args: { threadId: v.id("threads"), title: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, { title: args.title });
  },
});

export const deleteThread = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    await ctx.db.delete(args.threadId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});

export const pinThread = mutation({
  args: { threadId: v.id("threads"), pinned: v.boolean() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, { pinned: args.pinned });
  },
});
