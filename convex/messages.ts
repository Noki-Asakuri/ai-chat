import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAllMessagesFromThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
  },
});

export const addMessagesToThread = mutation({
  args: {
    threadId: v.string(),
    messages: v.array(
      v.object({
        messageId: v.string(),
        role: v.union(v.literal("assistant"), v.literal("user"), v.literal("system")),
        content: v.string(),
        status: v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming")),
        model: v.string(),

        createdAt: v.number(),
        updatedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      await ctx.db.insert("threads", { threadId: args.threadId, title: "New Chat" });
    }

    for (const message of args.messages) {
      await ctx.db.insert("messages", {
        threadId: args.threadId,
        ...message,
      });
    }
  },
});

export const updateMessageById = mutation({
  args: {
    messageId: v.string(),
    updates: v.object({
      status: v.optional(v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming"))),
      content: v.optional(v.string()),
      metadata: v.optional(
        v.object({
          duration: v.number(),
          finishReason: v.string(),
          totalTokens: v.number(),
          thinkingTokens: v.number(),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!message) throw new Error("Message not found");
    await ctx.db.patch(message._id, args.updates);
  },
});
