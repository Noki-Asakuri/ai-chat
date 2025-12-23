import { defineSchema, defineTable } from "convex/server";
import { v, type VLiteral } from "convex/values";

const providerMetadata = v.optional(v.record(v.string(), v.record(v.string(), v.any())));
const state = v.optional(v.union(v.literal("done"), v.literal("streaming")));

export const effort = v.union(
  v.literal("none"),
  v.literal("minimal"),
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("xhigh"),
);

export const status = v.union(
  v.literal("pending"),
  v.literal("streaming"),
  v.literal("complete"),
  v.literal("error"),
);

export const AISDKParts = v.array(
  v.union(
    v.object({ type: v.literal("step-start") }),
    v.object({ type: v.literal("text"), text: v.string(), providerMetadata, state }),
    v.object({ type: v.literal("reasoning"), text: v.string(), providerMetadata, state }),
    v.object({
      type: v.literal("file"),
      url: v.string(),
      mediaType: v.string(),
      filename: v.optional(v.string()),
    }),
    v.object({
      type: v.literal("source-url"),
      sourceId: v.string(),
      url: v.string(),
      title: v.optional(v.string()),
      providerMetadata,
    }),
    v.object({
      type: v.literal("source-document"),
      sourceId: v.string(),
      mediaType: v.string(),
      title: v.string(),
      filename: v.optional(v.string()),
      providerMetadata,
    }),
    v.object({
      type: v.literal("dynamic-tool"),
      state: v.literal("input-streaming"),
      toolName: v.string(),
      toolCallId: v.string(),
      input: v.any(),
      output: v.optional(v.any()),
      errorText: v.optional(v.string()),
    }),
    v.object({
      type: v.literal("dynamic-tool"),
      state: v.literal("input-available"),
      toolName: v.string(),
      toolCallId: v.string(),
      input: v.any(),
      output: v.optional(v.any()),
      errorText: v.optional(v.string()),
      callProviderMetadata: providerMetadata,
    }),
    v.object({
      type: v.literal("dynamic-tool"),
      state: v.literal("output-available"),
      toolName: v.string(),
      toolCallId: v.string(),
      input: v.any(),
      output: v.any(),
      errorText: v.optional(v.string()),
      callProviderMetadata: providerMetadata,
    }),
    v.object({
      type: v.literal("dynamic-tool"),
      state: v.literal("output-error"),
      toolName: v.string(),
      toolCallId: v.string(),
      input: v.any(),
      output: v.optional(v.any()),
      errorText: v.string(),
      callProviderMetadata: providerMetadata,
    }),
    v.object({
      type: v.string() as unknown as VLiteral<`tools-${string}`, "required">,
      state: v.literal("input-streaming"),
      toolCallId: v.string(),
      input: v.any(),
      providerExecuted: v.optional(v.boolean()),
      output: v.optional(v.any()),
      errorText: v.optional(v.string()),
    }),
    v.object({
      type: v.string() as unknown as VLiteral<`tools-${string}`, "required">,
      state: v.literal("input-available"),
      toolCallId: v.string(),
      input: v.any(),
      providerExecuted: v.optional(v.boolean()),
      output: v.optional(v.any()),
      errorText: v.optional(v.string()),
      callProviderMetadata: providerMetadata,
    }),
    v.object({
      type: v.string() as unknown as VLiteral<`tools-${string}`, "required">,
      state: v.literal("output-available"),
      toolCallId: v.string(),
      input: v.any(),
      providerExecuted: v.optional(v.boolean()),
      output: v.any(),
      errorText: v.optional(v.string()),
      callProviderMetadata: providerMetadata,
      preliminary: v.optional(v.boolean()),
    }),
    v.object({
      type: v.string() as unknown as VLiteral<`tools-${string}`, "required">,
      state: v.literal("output-error"),
      toolCallId: v.string(),
      input: v.any(),
      providerExecuted: v.optional(v.boolean()),
      output: v.optional(v.any()),
      errorText: v.string(),
      callProviderMetadata: providerMetadata,
    }),
  ),
);

export const AISDKModelParams = v.object({
  effort: effort,
  webSearch: v.boolean(),
  profile: v.optional(v.nullable(v.id("profiles"))),
});

export const AISDKMetadata = v.object({
  model: v.object({ request: v.string(), response: v.nullable(v.string()) }),
  finishReason: v.nullable(v.string()),

  usages: v.object({
    inputTokens: v.number(),
    outputTokens: v.number(),
    reasoningTokens: v.number(),
  }),

  timeToFirstTokenMs: v.number(),
  durations: v.object({ request: v.number(), reasoning: v.number(), text: v.number() }),

  modelParams: AISDKModelParams,
});

export default defineSchema({
  groups: defineTable({
    title: v.string(),
    order: v.number(),
    userId: v.string(),
  }).index("by_userId_order", ["userId", "order"]),

  threads: defineTable({
    title: v.string(),
    userId: v.string(),
    updatedAt: v.number(),
    pinned: v.boolean(),
    branchedFrom: v.optional(v.id("threads")),

    groupId: v.nullable(v.id("groups")),
    order: v.number(),

    status: status,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_groupId_order", ["userId", "groupId", "order"])
    .index("by_userId_pinned_updatedAt", ["userId", "pinned", "updatedAt"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["userId", "pinned"] }),

  attachments: defineTable({
    id: v.string(),
    name: v.string(),
    size: v.number(),
    type: v.union(v.literal("image"), v.literal("pdf")),
    source: v.union(v.literal("assistant"), v.literal("user")),
    mimeType: v.string(),
    path: v.string(),

    userId: v.string(),
    threadId: v.id("threads"),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_threadId", ["userId", "threadId"])
    .index("by_UUID", ["id"]),

  messages: defineTable({
    threadId: v.id("threads"),
    userId: v.string(),

    messageId: v.string(),
    error: v.optional(v.string()),

    parts: AISDKParts,
    status: status,

    role: v.union(v.literal("assistant"), v.literal("user")),
    resumableStreamId: v.optional(v.nullable(v.string())),

    metadata: v.optional(AISDKMetadata),
    attachments: v.array(v.id("attachments")),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_threadId", ["userId", "threadId"])
    .index("by_threadId", ["threadId"])
    .index("by_messageId", ["messageId"])
    .index("by_userId_resumableStreamId", ["userId", "resumableStreamId"]),

  profiles: defineTable({
    userId: v.string(),
    name: v.string(),
    systemPrompt: v.string(),
    imageKey: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["userId"] }),

  users: defineTable({
    userId: v.string(),

    username: v.nullable(v.string()),
    emailAddress: v.nullable(v.string()),
    imageUrl: v.nullable(v.string()),

    isBanned: v.optional(v.boolean()),

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),

    customization: v.object({
      name: v.string(),
      occupation: v.string(),
      traits: v.array(v.string()),
      systemInstruction: v.string(),
      backgroundId: v.nullable(v.string()),
      disableBlur: v.boolean(),
      hiddenModels: v.array(v.string()),
      showFullCode: v.boolean(),
    }),
  }).index("by_userId", ["userId"]),

  usages: defineTable({
    userId: v.string(),
    used: v.number(),
    base: v.number(),
    resetType: v.optional(v.union(v.literal("monthly"), v.literal("daily"))),

    // @deprecate, no point of using this anymore
    resetAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  session: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  user_stats: defineTable({
    userId: v.string(),

    stats: v.object({
      threads: v.number(),
      messages: v.object({ assistant: v.number(), user: v.number() }),

      /**
       * Token aggregates derived from assistant message metadata.
       *
       * IMPORTANT:
       * - input tokens are stored as *deduplicated deltas* (see internal stats mutation).
       * - output/reasoning tokens are stored as reported by the model for that completion.
       */
      tokens: v.optional(
        v.object({
          input: v.number(),
          output: v.number(),
          reasoning: v.number(),
          total: v.number(),
        }),
      ),

      /**
       * Convenience totals for quick UI display.
       * - user = input token deltas
       * - assistant = output + reasoning tokens
       */
      tokensByRole: v.optional(v.object({ assistant: v.number(), user: v.number() })),

      // Legacy word-based stats (deprecated; kept optional for backward-compatibility with old docs)
      words: v.optional(v.number()),
      wordsByRole: v.optional(v.object({ assistant: v.number(), user: v.number() })),
    }),

    /**
     * Ranking aggregates. Values represent total tokens for the bucket.
     * (Previously message counts.)
     */
    modelCounts: v.record(v.string(), v.number()),
    threadCounts: v.record(v.id("threads"), v.number()),
    activityCounts: v.record(v.string(), v.number()),
    aiProfileCounts: v.record(v.string(), v.number()),

    lastUpdatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
