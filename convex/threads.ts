import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createThread = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("threads", {
      updatedAt: Date.now() + 1,
      userId: user.tokenIdentifier,
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
      .withIndex("by_userId", (q) => q.eq("userId", user.tokenIdentifier))
      .collect();

    return data.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const updateThreadTitle = mutation({
  args: { threadId: v.id("threads"), title: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.tokenIdentifier) throw new Error("Not authorized");

    await ctx.db.patch(args.threadId, { title: args.title });
  },
});
