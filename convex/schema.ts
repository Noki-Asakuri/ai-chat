import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  threads: defineTable({
    title: v.string(),
    updatedAt: v.number(),
  }),

  messages: defineTable({
    threadId: v.id("threads"),

    messageId: v.string(),
    content: v.string(),
    reasoning: v.optional(v.string()),
    error: v.optional(v.string()),

    model: v.string(),
    status: v.union(v.literal("pending"), v.literal("complete"), v.literal("streaming"), v.literal("error")),
    role: v.union(v.literal("assistant"), v.literal("user"), v.literal("system")),

    resumableStreamId: v.optional(v.union(v.string(), v.null())),

    modelParams: v.optional(
      v.object({
        temperature: v.optional(v.number()),
        top_p: v.optional(v.number()),
        top_k: v.optional(v.number()),
        frequency_penalty: v.optional(v.number()),
        presence_penalty: v.optional(v.number()),

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

    metadata: v.optional(
      v.object({
        duration: v.number(),
        finishReason: v.string(),
        totalTokens: v.number(),
        thinkingTokens: v.number(),
      }),
    ),
  })
    .index("by_threadId", ["threadId"])
    .index("by_messageId", ["messageId"]),
});
