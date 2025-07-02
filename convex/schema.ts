import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  threads: defineTable({
    title: v.string(),
    userId: v.string(),
    updatedAt: v.number(),
    pinned: v.optional(v.boolean()),
    branchedFrom: v.optional(v.id("threads")),

    status: v.optional(
      v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming")),
    ),
  }).index("by_userId", ["userId"]),

  attachments: defineTable({
    id: v.string(),
    name: v.string(),
    size: v.number(),
    type: v.union(v.literal("image"), v.literal("pdf")),
    userId: v.string(),
    threadId: v.id("threads"),
  }).index("by_userId", ["userId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    userId: v.string(),

    messageId: v.string(),
    content: v.string(),
    reasoning: v.optional(v.string()),
    error: v.optional(v.string()),

    model: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("complete"),
      v.literal("streaming"),
      v.literal("error"),
    ),
    role: v.union(v.literal("assistant"), v.literal("user"), v.literal("system")),

    resumableStreamId: v.optional(v.union(v.string(), v.null())),

    modelParams: v.optional(
      v.object({
        temperature: v.optional(v.number()),
        top_p: v.optional(v.number()),
        top_k: v.optional(v.number()),
        frequency_penalty: v.optional(v.number()),
        presence_penalty: v.optional(v.number()),

        enableWebSearch: v.optional(v.boolean()),
        enableThinking: v.optional(v.boolean()),
        thinkingBudget: v.optional(v.number()),
        reasoningEffort: v.optional(v.number()),
      }),
    ),

    createdAt: v.number(),
    updatedAt: v.number(),

    sources: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.optional(v.string()),
          url: v.string(),
        }),
      ),
    ),

    attachments: v.optional(v.array(v.id("attachments"))),

    metadata: v.optional(
      v.object({
        model: v.optional(v.string()),
        duration: v.number(),
        finishReason: v.string(),
        totalTokens: v.number(),
        thinkingTokens: v.number(),
      }),
    ),
  })
    .index("by_userId_threadId", ["userId", "threadId"])
    .index("by_threadId", ["threadId"])
    .index("by_messageId", ["messageId"]),

  users: defineTable({
    userId: v.string(),

    username: v.union(v.string(), v.null()),
    emailAddress: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),

    isBanned: v.optional(v.boolean()),

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),

    customization: v.optional(
      v.object({
        name: v.optional(v.string()),
        occupation: v.optional(v.string()),
        traits: v.optional(v.array(v.string())),
        systemInstruction: v.optional(v.string()),
        backgroundId: v.optional(v.union(v.string(), v.null())),
      }),
    ),
  }).index("by_userId", ["userId"]),
});
