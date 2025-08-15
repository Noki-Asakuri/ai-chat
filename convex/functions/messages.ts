import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";

export const getAllMessagesFromThread = query({
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    if (!args.threadId) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.subject).eq("threadId", args.threadId!),
      )
      .order("asc")
      .collect();

    return await Promise.all(
      messages.map(async (message) => {
        const attachmentDocs = await Promise.all(
          (message.attachments ?? []).map((attachmentId) => ctx.db.get(attachmentId)),
        );
        const attachments = attachmentDocs.filter((a): a is Doc<"attachments"> => a !== null);

        return { ...message, attachments };
      }),
    );
  },
});

export const addAttachmentsToMessage = mutation({
  args: { messageId: v.string(), attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();

    if (!message) throw new Error("Message not found");
    if (message.userId !== user.subject) throw new Error("Not authorized");

    await ctx.db.patch(message._id, { attachments: [args.attachmentId] });
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

        attachments: v.optional(v.array(v.id("attachments"))),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);

    if (!thread) {
      await ctx.db.insert("threads", {
        title: "New Chat",
        updatedAt: Date.now() + 1,
        userId: user.subject,
      });
    } else if (thread.userId !== user.subject) {
      throw new Error("Not authorized");
    }

    let assistantMessageId: Id<"messages"> | undefined;
    for (const message of args.messages) {
      const data = await ctx.db.insert("messages", {
        threadId: args.threadId,
        userId: user.subject,
        ...message,
      });

      if (message.role === "assistant") assistantMessageId = data;
    }

    return assistantMessageId;
  },
});

export const updateErrorMessage = mutation({
  args: { messageId: v.id("messages"), error: v.string(), model: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== user.subject) throw new Error("Not authorized");

    await ctx.db.patch(args.messageId, {
      status: "error",
      error: args.error,
      model: args.model,
      resumableStreamId: null,
      updatedAt: Date.now(),
    });

    await ctx.db.patch(message.threadId, { updatedAt: Date.now(), status: "complete" });
  },
});

export const updateMessageById = mutation({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    updates: v.object({
      status: v.optional(
        v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming")),
      ),
      content: v.optional(v.string()),
      reasoning: v.optional(v.string()),
      model: v.optional(v.string()),
      resumableStreamId: v.optional(v.union(v.string(), v.null())),
      sources: v.optional(
        v.array(v.object({ id: v.string(), title: v.optional(v.string()), url: v.string() })),
      ),

      metadata: v.optional(
        v.object({
          model: v.string(),
          duration: v.number(),
          finishReason: v.string(),
          totalTokens: v.number(),
          thinkingTokens: v.number(),
          timeToFirstTokenMs: v.optional(v.number()),
          // Attach AI profile reference in metadata as well
          aiProfileId: v.optional(v.id("ai_profiles")),
          durations: v.optional(
            v.object({ request: v.number(), reasoning: v.number(), text: v.number() }),
          ),
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
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== user.subject) throw new Error("Not authorized");

    if (message.status === "error") return;

    await ctx.db.patch(args.messageId, { ...args.updates, updatedAt: Date.now() });
    if (args.threadId) {
      await ctx.db.patch(args.threadId, {
        updatedAt: Date.now(),
        ...(args.updates.status !== undefined ? { status: args.updates.status } : {}),
      });
    }
  },
});

export const retryChatMessage = mutation({
  args: {
    threadId: v.id("threads"),
    assistantMessageId: v.id("messages"),
    userMessage: v.object({
      messageId: v.id("messages"),
      content: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    const assistantMessage = await ctx.db.get(args.assistantMessageId);
    if (!assistantMessage) throw new Error("Message not found");

    const deleteMessages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q
          .eq("userId", user.subject)
          .eq("threadId", args.threadId)
          .gt("_creationTime", assistantMessage._creationTime),
      )
      .collect();

    if (args.userMessage.content) {
      await ctx.db.patch(args.userMessage.messageId, {
        content: args.userMessage.content,
        updatedAt: Date.now(),
      });
    }

    for (const message of deleteMessages) {
      await ctx.db.delete(message._id);
    }

    await Promise.all([
      ctx.db.patch(args.threadId, { updatedAt: Date.now() }),
      ctx.db.patch(args.assistantMessageId, {
        messageId: crypto.randomUUID(),
        status: "pending",
        content: "",
        reasoning: "",
        metadata: undefined,
        sources: undefined,
        resumableStreamId: null,
        error: undefined,
        modelParams: undefined,
        model: "",
        attachments: [],
        updatedAt: Date.now(),
      }),
    ]);
  },
});
