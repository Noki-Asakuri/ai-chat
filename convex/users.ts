import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const deleteUserData = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const threadPromises = ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const messagePromises = ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", args.userId))
      .collect();

    const [threads, messages] = await Promise.all([threadPromises, messagePromises]);

    for (const thread of threads) {
      await ctx.db.delete(thread._id);
    }

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});
