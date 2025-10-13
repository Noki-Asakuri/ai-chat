import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const providerMetadata = v.optional(v.record(v.string(), v.record(v.string(), v.any())));
const state = v.optional(v.union(v.literal("done"), v.literal("streaming")));

export const effort = v.union(
  v.literal("minimal"),
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
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
      type: v.literal(`tool-${v.string()}`),
      state: v.literal("input-streaming"),
      toolCallId: v.string(),
      input: v.any(),
      providerExecuted: v.optional(v.boolean()),
      output: v.optional(v.any()),
      errorText: v.optional(v.string()),
    }),
    v.object({
      type: v.literal(`tool-${v.string()}`),
      state: v.literal("input-available"),
      toolCallId: v.string(),
      input: v.any(),
      providerExecuted: v.optional(v.boolean()),
      output: v.optional(v.any()),
      errorText: v.optional(v.string()),
      callProviderMetadata: providerMetadata,
    }),
    v.object({
      type: v.literal(`tool-${v.string()}`),
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
      type: v.literal(`tool-${v.string()}`),
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

export const AISDKMetadata = v.object({
  model: v.string(),
  finishReason: v.string(),
  usages: v.object({
    inputTokens: v.number(),
    outputTokens: v.number(),
    reasoningTokens: v.number(),
  }),
  timeToFirstTokenMs: v.number(),
  aiProfileId: v.optional(v.id("ai_profiles")),
  durations: v.object({ request: v.number(), reasoning: v.number(), text: v.number() }),
});

export const AISDKModelParams = v.object({
  webSearchEnabled: v.boolean(),
  effort: effort,
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

    groupId: v.union(v.id("groups"), v.null()),
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
    .index("by_UUID", ["id"]),

  messages: defineTable({
    threadId: v.id("threads"),
    userId: v.string(),

    messageId: v.string(),
    content: v.string(),
    reasoning: v.optional(v.string()),
    error: v.optional(v.string()),

    parts: AISDKParts,

    model: v.string(),
    status: status,

    role: v.union(v.literal("assistant"), v.literal("user")),
    resumableStreamId: v.optional(v.union(v.string(), v.null())),

    metadata: v.optional(AISDKMetadata),
    modelParams: v.optional(AISDKModelParams),
    attachments: v.array(v.id("attachments")),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_threadId", ["userId", "threadId"])
    .index("by_threadId", ["threadId"])
    .index("by_messageId", ["messageId"]),

  ai_profiles: defineTable({
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

    username: v.union(v.string(), v.null()),
    emailAddress: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),

    isBanned: v.optional(v.boolean()),

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),

    customization: v.object({
      name: v.optional(v.string()),
      occupation: v.optional(v.string()),
      traits: v.optional(v.array(v.string())),
      systemInstruction: v.optional(v.string()),
      backgroundId: v.optional(v.union(v.string(), v.null())),
      disableBlur: v.optional(v.boolean()),
      hiddenModels: v.optional(v.array(v.string())),
      showFullCode: v.optional(v.boolean()),
    }),
  }).index("by_userId", ["userId"]),

  usages: defineTable({
    userId: v.string(),
    used: v.number(),
    base: v.number(),
    resetAt: v.number(),
  }).index("by_userId", ["userId"]),

  user_stats: defineTable({
    userId: v.string(),

    stats: v.object({
      threads: v.number(),
      words: v.number(),
      messages: v.object({ assistant: v.number(), user: v.number() }),
      wordsByRole: v.object({ assistant: v.number(), user: v.number() }),
    }),

    modelCounts: v.record(v.string(), v.number()),
    threadCounts: v.record(v.id("threads"), v.number()),
    activityCounts: v.record(v.string(), v.number()),
    aiProfileCounts: v.record(v.string(), v.number()),

    lastUpdatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
