import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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

    let assistantMessageId: Id<"messages"> | undefined;

    for (const message of args.messages) {
      const data = await ctx.db.insert("messages", {
        threadId: args.threadId,
        ...message,
      });

      if (message.role === "assistant") assistantMessageId = data;
    }

    return assistantMessageId;
  },
});

export const getMessageByMessageId = query({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();
  },
});

export const updateMessageById = mutation({
  args: {
    messageId: v.id("messages"),
    updates: v.object({
      status: v.optional(
        v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming"), v.literal("error")),
      ),
      content: v.optional(v.string()),
      reasoning: v.optional(v.string()),
      model: v.optional(v.string()),
      resumableStreamId: v.optional(v.union(v.string(), v.null())),
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
    await ctx.db.patch(args.messageId, args.updates);
  },
});

export const retryChatMessage = mutation({
  args: {
    messageIds: v.array(v.id("messages")),
    threadId: v.string(),
    message: v.object({
      messageId: v.string(),
      role: v.union(v.literal("assistant"), v.literal("system")),
      content: v.string(),
      status: v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming")),
      model: v.string(),

      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    for (const messageId of args.messageIds) {
      await ctx.db.delete(messageId);
    }

    return await ctx.db.insert("messages", { threadId: args.threadId, ...args.message });
  },
});
