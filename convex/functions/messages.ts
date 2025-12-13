import { asyncMap } from "convex-helpers";
import { getAll } from "convex-helpers/server/relationships";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { authenticatedMutation, authenticatedQuery } from "../components";
import { AISDKMetadata, AISDKModelParams, AISDKParts, status } from "../schema";

export const getAllMessagesFromThread = authenticatedQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = ctx.user;

    if (!user) throw new Error("Not authenticated");
    if (!args.threadId) throw new Error("Thread not found");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread?.userId !== user.userId) throw new Error("Not authorized");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.userId).eq("threadId", args.threadId),
      )
      .order("asc")
      .collect();

    const messagesWithAttachments = await asyncMap(messages, async (message) => {
      const attachmentsRaw = await getAll(ctx.db, message.attachments);
      const attachments = attachmentsRaw.filter(Boolean) as Doc<"attachments">[];
      return { ...message, attachments };
    });

    return { messages: messagesWithAttachments, thread };
  },
});

export const getAllMessagesWithoutAttachments = authenticatedQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.userId).eq("threadId", args.threadId!),
      )
      .order("asc")
      .collect();

    return messages;
  },
});

export const addAttachmentsToMessage = authenticatedMutation({
  args: { messageId: v.string(), attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();

    if (!message) throw new Error("Message not found");
    if (message.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch("messages", message._id, { attachments: [args.attachmentId] });
  },
});

export const addMessagesToThread = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    messages: v.array(
      v.object({
        messageId: v.string(),
        role: v.union(v.literal("assistant"), v.literal("user")),

        status: status,
        parts: AISDKParts,
        metadata: v.optional(AISDKMetadata),

        attachments: v.array(v.id("attachments")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const [userMessage, assistantMessage] = args.messages as [
      (typeof args.messages)[0],
      (typeof args.messages)[1],
    ];

    const now = Date.now();

    const shared = {
      threadId: args.threadId,
      userId: user.userId,
      createdAt: now,
      updatedAt: now,

      metadata: undefined,
      resumableStreamId: null,
    };

    const [, assistantMessageId] = await Promise.all([
      ctx.db.insert("messages", { ...shared, ...userMessage }),
      // So that we can sort by createdAt and have the assistant message come after the user message
      ctx.db.insert("messages", { ...shared, ...assistantMessage, createdAt: now + 1 }),
    ]);

    // await ctx.runMutation(internal.functions.userStats.incrementOnUserMessage, {
    //   userId: user.userId,
    //   threadId: args.threadId,
    //   createdAt: userMessage.createdAt,
    // });

    return assistantMessageId;
  },
});

export const updateErrorMessage = authenticatedMutation({
  args: {
    messageId: v.id("messages"),
    error: v.string(),
    metadata: AISDKMetadata.partial(),
  },
  handler: async (ctx, args) => {
    // const user = ctx.user;
    // if (!user) throw new Error("Not authenticated");
    // const message = await ctx.db.get(args.messageId);
    // if (!message) throw new Error("Message not found");
    // if (message.userId !== user.userId) throw new Error("User not authorized");
    // await ctx.db.patch(args.messageId, {
    //   status: "error",
    //   error: args.error,
    //   model: args.model,
    //   modelParams: args.modelParams,
    //   resumableStreamId: null,
    //   updatedAt: Date.now(),
    // });
    // await ctx.db.patch(message.threadId, {
    //   updatedAt: Date.now(),
    //   status: "complete",
    // });
  },
});

export const updateMessageById = authenticatedMutation({
  args: {
    messageId: v.id("messages"),
    updates: v
      .object({
        status: status,
        resumableStreamId: v.nullable(v.string()),

        parts: AISDKParts,
        metadata: AISDKMetadata,
        attachments: v.array(v.id("attachments")),
      })
      .partial(),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    console.log("Updating message by Id", {
      userId: user.userId,
      messageId: args.messageId,
      messageUserId: message?.userId ?? "Message not found",
      status: args.updates.status,
      messageThreadId: message?.threadId ?? "Message not found",
    });

    if (!message) throw new Error("Message not found");
    if (message.userId !== user.userId) throw new Error("User not authorized");
    if (message.status === "error") return;

    await ctx.db.patch(args.messageId, { ...args.updates, updatedAt: Date.now() });

    if (message.threadId) {
      await ctx.db.patch(message.threadId, {
        updatedAt: Date.now(),
        ...(args.updates.status !== undefined ? { status: args.updates.status } : {}),
      });
    }

    const becameComplete = message.status !== "complete" && args.updates.status === "complete";

    // if (message.role === "assistant" && becameComplete) {
    //   const content = args.updates.content ?? message.content ?? "";
    //   const modelUniqueId = args.updates.model ?? message.model ?? "";
    //   const profileId = args.updates.metadata?.profile?.id ?? message.metadata?.profile?.id;

    //   await ctx.runMutation(internal.functions.userStats.incrementOnAssistantComplete, {
    //     userId: user.userId,
    //     threadId: message.threadId,
    //     content,
    //     modelUniqueId,
    //     createdAt: message.createdAt,
    //     ...(profileId ? { profileId } : {}),
    //   });
    // }
  },
});

export const retryChatMessage = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    assistantMessageId: v.id("messages"),

    model: v.string(),
    modelParams: AISDKModelParams,

    userMessage: v.optional(v.object({ messageId: v.id("messages"), parts: AISDKParts })),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const assistantMessage = await ctx.db.get(args.assistantMessageId);
    if (!assistantMessage) throw new Error("Message not found");

    const deleteMessages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q
          .eq("userId", user.userId)
          .eq("threadId", args.threadId)
          .gt("_creationTime", assistantMessage._creationTime),
      )
      .collect();

    if (args.userMessage) {
      await ctx.db.patch(args.userMessage.messageId, {
        updatedAt: Date.now(),
        parts: args.userMessage.parts,
      });
    }

    for (const message of deleteMessages) {
      await ctx.db.delete(message._id);
    }

    await Promise.all([
      ctx.db.patch("threads", args.threadId, { status: "pending", updatedAt: Date.now() }),
      ctx.db.patch("messages", args.assistantMessageId, {
        messageId: crypto.randomUUID(),
        status: "pending",
        parts: [],
        resumableStreamId: null,
        error: undefined,

        updatedAt: Date.now(),

        metadata: {
          durations: { request: 0, reasoning: 0, text: 0 },
          usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
          timeToFirstTokenMs: 0,
          finishReason: "",

          modelParams: args.modelParams,
          model: { request: args.model, response: null },
        },
      }),
    ]);
  },
});

// export const backfillMessageUsageStats = internalMutation({
//   args: { messageId: v.id("messages") },
//   handler: async (ctx, args) => {
//     const message = await ctx.db.get(args.messageId);
//     if (!message || !message.metadata) return;

//     const reasoningTokens = message.metadata?.usages.reasoningTokens ?? 0;
//     const outputTokens = message.metadata?.usages.outputTokens ?? 0;

//     await ctx.db.patch(message._id, {
//       metadata: { ...message.metadata, usages: { inputTokens: 0, outputTokens, reasoningTokens } },
//     });
//   },
// });
