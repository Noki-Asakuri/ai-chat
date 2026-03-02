import { v } from "convex/values";

import { tryGetModelData } from "../../src/lib/chat/models";
import { type Doc, type Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";

function dayKey(ts: number): string {
  const d = new Date(ts);
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  return iso.split("T")[0] ?? "";
}

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type TokenTotals = {
  input: number;
  output: number;
  reasoning: number;
  total: number;
};

function addTokenTotals(a: TokenTotals, b: TokenTotals): TokenTotals {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    reasoning: a.reasoning + b.reasoning,
    total: a.total + b.total,
  };
}

function makeTokenTotals(input: number, output: number, reasoning: number): TokenTotals {
  const i = clampNonNegative(input);
  const o = clampNonNegative(output);
  const r = clampNonNegative(reasoning);
  return { input: i, output: o, reasoning: r, total: i + o + r };
}

async function getOrCreate(ctx: MutationCtx, userId: string): Promise<Doc<"user_stats">> {
  const existing = await ctx.db
    .query("user_stats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (existing) return existing;

  const now = Date.now();
  const id = await ctx.db.insert("user_stats", {
    userId,
    stats: {
      threads: 0,
      messages: { assistant: 0, user: 0 },
      tokens: { input: 0, output: 0, reasoning: 0, total: 0 },
      tokensByRole: { assistant: 0, user: 0 },

      // legacy fields (deprecated)
      words: 0,
      wordsByRole: { assistant: 0, user: 0 },
    },
    modelCounts: {},
    threadCounts: {},
    activityCounts: {},
    aiProfileCounts: {},
    lastUpdatedAt: now,
  });

  const doc = await ctx.db.get("user_stats", id);
  if (!doc) throw new Error("Failed to create user_stats");

  return doc;
}

export const incrementThreads = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await getOrCreate(ctx, args.userId);

    const stats = {
      ...doc.stats,
      threads: doc.stats.threads + 1,
    };

    await ctx.db.patch(doc._id, {
      stats,
      lastUpdatedAt: Date.now(),
    });

    return null;
  },
});

export const incrementOnUserMessage = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.id("threads"),
    createdAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await getOrCreate(ctx, args.userId);

    const day = dayKey(args.createdAt);

    const stats = {
      ...doc.stats,
      messages: {
        ...doc.stats.messages,
        user: doc.stats.messages.user + 1,
      },
    };

    const activityCounts: Record<string, number> = { ...doc.activityCounts };
    activityCounts[day] = (activityCounts[day] ?? 0) + 1;

    await ctx.db.patch(doc._id, {
      stats,
      activityCounts,
      lastUpdatedAt: Date.now(),
    });

    return null;
  },
});

export const incrementOnAssistantComplete = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.id("threads"),
    createdAt: v.number(),

    modelUniqueId: v.string(),
    profileId: v.optional(v.id("profiles")),

    /**
     * Full prompt tokens reported by the model (cumulative for the whole prompt).
     * We store a deduplicated delta in user stats to avoid double counting.
     */
    inputTokens: v.number(),
    outputTokens: v.number(),
    reasoningTokens: v.number(),

    /**
     * Previous assistant completion's cumulative input token count in this thread.
     * If unknown, pass 0 so delta == inputTokens.
     */
    previousInputTokens: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await getOrCreate(ctx, args.userId);

    // `args.inputTokens` is cumulative prompt tokens reported by the model for this completion.
    // We store *deduplicated* input tokens so user totals reflect incremental usage per reply.
    const inputDelta = clampNonNegative(args.inputTokens - args.previousInputTokens);
    const added = makeTokenTotals(inputDelta, args.outputTokens, args.reasoningTokens);

    const prevTotals = doc.stats.tokens
      ? makeTokenTotals(doc.stats.tokens.input, doc.stats.tokens.output, doc.stats.tokens.reasoning)
      : makeTokenTotals(0, 0, 0);

    const nextTotals = addTokenTotals(prevTotals, added);

    const prevTokensByRole = doc.stats.tokensByRole ?? { assistant: 0, user: 0 };
    const nextTokensByRole = {
      assistant: prevTokensByRole.assistant + added.output + added.reasoning,
      user: prevTokensByRole.user + added.input,
    };

    const stats = {
      ...doc.stats,
      messages: {
        ...doc.stats.messages,
        assistant: doc.stats.messages.assistant + 1,
      },
      tokens: nextTotals,
      tokensByRole: nextTokensByRole,
    };

    const threadCounts: Record<Id<"threads">, number> = { ...doc.threadCounts };
    threadCounts[args.threadId] = (threadCounts[args.threadId] ?? 0) + added.total;

    const modelCounts: Record<string, number> = { ...doc.modelCounts };
    const normalizedModelId = tryGetModelData(args.modelUniqueId)?.id ?? args.modelUniqueId;
    modelCounts[normalizedModelId] = (modelCounts[normalizedModelId] ?? 0) + added.total;

    const aiProfileCounts: Record<string, number> = { ...doc.aiProfileCounts };
    const aiKey = args.profileId ?? "null";
    aiProfileCounts[aiKey] = (aiProfileCounts[aiKey] ?? 0) + added.total;

    await ctx.db.patch(doc._id, {
      stats,
      threadCounts,
      modelCounts,
      aiProfileCounts,
      lastUpdatedAt: Date.now(),
    });

    return null;
  },
});
