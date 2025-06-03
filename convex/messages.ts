import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

export const getAllMessagesFromThread = query({
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    if (!args.threadId) return [];

    return await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId!))
      .collect();
  },
});

export const addMessagesToThread = mutation({
  args: {
    threadId: v.id("threads"),
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
      .withIndex("by_id", (q) => q.eq("_id", args.threadId))
      .unique();

    if (!thread) {
      await ctx.db.insert("threads", { title: "New Chat" });
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
    threadId: v.id("threads"),
    message: v.object({
      messageId: v.string(),
      role: v.union(v.literal("assistant"), v.literal("system")),
      content: v.string(),
      status: v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming")),
      model: v.string(),

      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    userMessage: v.optional(
      v.object({
        messageId: v.id("messages"),
        role: v.literal("user"),
        content: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const messageId of args.messageIds) {
      await ctx.db.delete(messageId);
    }

    if (args.userMessage) {
      await ctx.db.patch(args.userMessage.messageId, {
        content: args.userMessage.content,
        updatedAt: Date.now(),
      });
    }

    return await ctx.db.insert("messages", { threadId: args.threadId, ...args.message });
  },
});
