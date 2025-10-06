import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";

export const getAllMessagesFromThread = query({
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();

    if (!user) throw new Error("Not authenticated");
    if (!args.threadId) return null;

    const thread = await ctx.db.get(args.threadId);
    if (thread?.userId !== user.subject) throw new Error("Not authorized");

    const messagesFromThread = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.subject).eq("threadId", args.threadId!),
      )
      .order("asc")
      .collect();

    const messages = await Promise.all(
      messagesFromThread.map(async (message) => {
        const attachmentDocs = await Promise.all(
          (message.attachments ?? []).map((attachmentId) => ctx.db.get(attachmentId)),
        );
        const attachments = attachmentDocs.filter((a): a is Doc<"attachments"> => a !== null);
        return { ...message, attachments };
      }),
    );

    return { messages, thread };
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
        role: v.union(v.literal("assistant"), v.literal("user")),
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
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    let assistantMessageId: Id<"messages"> | undefined;
    for (const message of args.messages) {
      const data = await ctx.db.insert("messages", {
        threadId: args.threadId,
        userId: user.subject,
        ...message,
      });

      if (message.role === "assistant") assistantMessageId = data;
      if (message.role === "user") {
        await ctx.runMutation(internal.functions.userStats.incrementOnUserMessage, {
          userId: user.subject,
          threadId: args.threadId,
          content: message.content,
          createdAt: message.createdAt,
        });
      }
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

    await ctx.db.patch(message.threadId, {
      updatedAt: Date.now(),
      status: "complete",
    });
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
        v.array(
          v.object({
            id: v.string(),
            title: v.optional(v.string()),
            url: v.string(),
          }),
        ),
      ),
      // Allow exact attachment list updates for a message (unlink/link only)
      attachments: v.optional(v.array(v.id("attachments"))),

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
            v.object({
              request: v.number(),
              reasoning: v.number(),
              text: v.number(),
            }),
          ),
          usages: v.optional(
            v.object({
              inputTokens: v.number(),
              outputTokens: v.number(),
              reasoningTokens: v.number(),
            }),
          ),
        }),
      ),
      modelParams: v.optional(
        v.object({
          webSearchEnabled: v.optional(v.boolean()),
          effort: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    console.log("Updating message by Id", {
      userId: user.subject,
      messageId: args.messageId,
      messageUserId: message?.userId ?? "Message not found",
      status: args.updates.status,
      threadId: args.threadId,
      messageThreadId: message?.threadId ?? "Message not found",
    });

    if (!message) throw new Error("Message not found");
    if (message.userId !== user.subject) throw new Error("Not authorized");
    if (message.threadId !== args.threadId) throw new Error("Not authorized");
    if (message.status === "error") return;

    await ctx.db.patch(args.messageId, {
      ...args.updates,
      updatedAt: Date.now(),
    });
    if (args.threadId) {
      await ctx.db.patch(args.threadId, {
        updatedAt: Date.now(),
        ...(args.updates.status !== undefined ? { status: args.updates.status } : {}),
      });
    }

    const becameComplete = message.status !== "complete" && args.updates.status === "complete";

    if (message.role === "assistant" && becameComplete) {
      const content = args.updates.content ?? message.content ?? "";
      const modelUniqueId = args.updates.model ?? message.model ?? "";
      const aiProfileId = args.updates.metadata?.aiProfileId ?? message.metadata?.aiProfileId;

      await ctx.runMutation(internal.functions.userStats.incrementOnAssistantComplete, {
        userId: user.subject,
        threadId: message.threadId,
        content,
        modelUniqueId,
        createdAt: message.createdAt,
        ...(aiProfileId ? { aiProfileId } : {}),
      });
    }
  },
});

export const retryChatMessage = mutation({
  args: {
    threadId: v.id("threads"),
    assistantMessageId: v.id("messages"),
    model: v.optional(v.string()),
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
        model: args.model ?? assistantMessage.model ?? "",
        attachments: [],
        updatedAt: Date.now(),
      }),
    ]);
  },
});

export const backfillMessageUsageStats = internalMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || !message.metadata) return;

    const reasoningTokens = message.metadata?.thinkingTokens ?? 0;
    const outputTokens = message.metadata?.totalTokens ?? 0;

    await ctx.db.patch(message._id, {
      metadata: {
        ...message.metadata,
        totalTokens: outputTokens,
        thinkingTokens: reasoningTokens,
        usages: { inputTokens: 0, outputTokens, reasoningTokens },
      },
    });
  },
});
