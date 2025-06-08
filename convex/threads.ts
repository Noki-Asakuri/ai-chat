import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const getAllThreads = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const data = await ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", user.subject))
      .collect();

    return data
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((thread) => ({
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
