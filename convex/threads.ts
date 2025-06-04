import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createThread = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db.insert("threads", { title: args.title ?? "New Chat", updatedAt: Date.now() + 1 });
  },
});

export const getAllThreads = query({
  args: {},
  handler: async (ctx) => {
    const data = await ctx.db.query("threads").collect();
    return data.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const updateThreadTitle = mutation({
  args: { threadId: v.id("threads"), title: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, { title: args.title });
  },
});
