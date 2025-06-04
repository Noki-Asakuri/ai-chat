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
      await ctx.db.insert("threads", { title: "New Chat", updatedAt: Date.now() + 1 });
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
    threadId: v.optional(v.id("threads")),
    messageId: v.id("messages"),
    updates: v.object({
      status: v.optional(
        v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming"), v.literal("error")),
      ),

      content: v.optional(v.string()),
      reasoning: v.optional(v.string()),
      error: v.optional(v.string()),
      model: v.optional(v.string()),
      resumableStreamId: v.optional(v.union(v.string(), v.null())),
      sources: v.optional(v.array(v.object({ id: v.string(), title: v.optional(v.string()), url: v.string() }))),
      metadata: v.optional(
        v.object({
          model: v.string(),
          duration: v.number(),
          finishReason: v.string(),
          totalTokens: v.number(),
          thinkingTokens: v.number(),
        }),
      ),
      modelParams: v.optional(
        v.object({
          temperature: v.optional(v.number()),
          top_p: v.optional(v.number()),
          top_k: v.optional(v.number()),
          frequency_penalty: v.optional(v.number()),
          presence_penalty: v.optional(v.number()),

          enableThinking: v.optional(v.boolean()),
          enableWebSearch: v.optional(v.boolean()),
          thinkingBudget: v.optional(v.number()),
          reasoningEffort: v.optional(v.number()),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { ...args.updates, updatedAt: Date.now() });
    if (args.threadId) {
      await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
    }
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

    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
    return await ctx.db.insert("messages", { threadId: args.threadId, ...args.message });
  },
});
