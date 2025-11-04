import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { AISDKMetadata, AISDKModelParams, AISDKParts, status } from "../schema";

export const getAllMessagesFromThread = query({
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();

    if (!user) throw new Error("Not authenticated");
    if (!args.threadId) return { messages: [], thread: null };

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
        model: v.string(),
        content: v.string(),
        messageId: v.string(),
        role: v.union(v.literal("assistant"), v.literal("user")),

        status: status,
        parts: AISDKParts,
        modelParams: AISDKModelParams,
        metadata: v.optional(AISDKMetadata),

        createdAt: v.number(),
        updatedAt: v.number(),
        attachments: v.array(v.id("attachments")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    const [userMessage, assistantMessage] = args.messages as [
      (typeof args.messages)[0],
      (typeof args.messages)[1],
    ];

    const [, assistantMessageId] = await Promise.all([
      ctx.db.insert("messages", { threadId: args.threadId, userId: user.subject, ...userMessage }),
      ctx.db.insert("messages", {
        threadId: args.threadId,
        userId: user.subject,
        ...assistantMessage,
      }),
    ]);

    await ctx.runMutation(internal.functions.userStats.incrementOnUserMessage, {
      userId: user.subject,
      threadId: args.threadId,
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    });

    return assistantMessageId;
  },
});

export const updateErrorMessage = mutation({
  args: {
    messageId: v.id("messages"),
    error: v.string(),
    model: v.string(),
    modelParams: AISDKModelParams,
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== user.subject) throw new Error("User not authorized");

    await ctx.db.patch(args.messageId, {
      status: "error",
      error: args.error,
      model: args.model,
      modelParams: args.modelParams,
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
    messageId: v.id("messages"),
    updates: v.object({
      status: v.optional(status),
      model: v.optional(v.string()),
      content: v.optional(v.string()),
      reasoning: v.optional(v.string()),
      resumableStreamId: v.optional(v.union(v.string(), v.null())),

      parts: v.optional(AISDKParts),
      metadata: v.optional(AISDKMetadata),
      modelParams: v.optional(AISDKModelParams),
      attachments: v.optional(v.array(v.id("attachments"))),
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
      messageThreadId: message?.threadId ?? "Message not found",
    });

    if (!message) throw new Error("Message not found");
    if (message.userId !== user.subject) throw new Error("User not authorized");
    if (message.status === "error") return;

    await ctx.db.patch(args.messageId, { ...args.updates, updatedAt: Date.now() });

    if (message.threadId) {
      await ctx.db.patch(message.threadId, {
        updatedAt: Date.now(),
        ...(args.updates.status !== undefined ? { status: args.updates.status } : {}),
      });
    }

    const becameComplete = message.status !== "complete" && args.updates.status === "complete";

    if (message.role === "assistant" && becameComplete) {
      const content = args.updates.content ?? message.content ?? "";
      const modelUniqueId = args.updates.model ?? message.model ?? "";
      const profileId = args.updates.metadata?.profile?.id ?? message.metadata?.profile?.id;

      await ctx.runMutation(internal.functions.userStats.incrementOnAssistantComplete, {
        userId: user.subject,
        threadId: message.threadId,
        content,
        modelUniqueId,
        createdAt: message.createdAt,
        ...(profileId ? { profileId } : {}),
      });
    }
  },
});

export const retryChatMessage = mutation({
  args: {
    threadId: v.id("threads"),
    assistantMessageId: v.id("messages"),

    model: v.optional(v.string()),
    modelParams: v.optional(AISDKModelParams),

    userMessage: v.object({
      messageId: v.id("messages"),
      parts: v.optional(AISDKParts),
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

    const defaultModelParams = { effort: "medium", webSearchEnabled: false } as const;

    const userUpdates: Partial<Doc<"messages">> = {
      updatedAt: Date.now(),
      model: args.model ?? assistantMessage.model ?? "",
      modelParams: args.modelParams ?? assistantMessage.modelParams ?? defaultModelParams,
    };

    if (args.userMessage.content) {
      userUpdates.content = args.userMessage.content;
      userUpdates.parts = args.userMessage.parts;
    }
    await ctx.db.patch(args.userMessage.messageId, userUpdates);

    for (const message of deleteMessages) {
      await ctx.db.delete(message._id);
    }

    await Promise.all([
      ctx.db.patch(args.threadId, { status: "pending", updatedAt: Date.now() }),
      ctx.db.patch(args.assistantMessageId, {
        messageId: crypto.randomUUID(),
        status: "pending",
        content: "",
        reasoning: "",
        parts: [],
        metadata: undefined,
        resumableStreamId: null,
        error: undefined,
        modelParams: args.modelParams ?? assistantMessage.modelParams ?? defaultModelParams,
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

    const reasoningTokens = message.metadata?.usages.reasoningTokens ?? 0;
    const outputTokens = message.metadata?.usages.outputTokens ?? 0;

    await ctx.db.patch(message._id, {
      metadata: { ...message.metadata, usages: { inputTokens: 0, outputTokens, reasoningTokens } },
    });
  },
});
