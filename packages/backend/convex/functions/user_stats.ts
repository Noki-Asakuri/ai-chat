import { v } from "convex/values";

import { tryGetModelData } from "@ai-chat/shared/chat/models";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";

export const DEFAULT_USER_STATS: Omit<
  Doc<"user_stats">,
  "_id" | "userId" | "lastUpdatedAt" | "_creationTime"
> = {
  threadsCount: 0,
  userMessagesCount: 0,
  assistantMessagesCount: 0,

  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,

  activityCounts: {},
  modelRequestCounts: {},
  aiProfileRequestCounts: {},
};

export function formatDateNumberToUTC(timestamp: number): string {
  const date = new Date(timestamp);

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());

  return `${day}-${month}-${year}`;
}

export async function getOrCreateUserStats(
  ctx: MutationCtx,
  userId: string,
): Promise<Doc<"user_stats">> {
  const existing = await ctx.db
    .query("user_stats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (existing) return existing;

  const now = Date.now();
  const userStatsId = await ctx.db.insert("user_stats", {
    userId,
    lastUpdatedAt: now,
    ...DEFAULT_USER_STATS,
  });

  const userStats = await ctx.db.get("user_stats", userStatsId);
  if (!userStats) throw new Error("Failed to create user_stats");

  return userStats;
}

export const incrementThreads = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userStats = await getOrCreateUserStats(ctx, args.userId);

    await ctx.db.patch(userStats._id, {
      threadsCount: userStats.threadsCount + 1,
      lastUpdatedAt: Date.now(),
    });
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
    const userStats = await getOrCreateUserStats(ctx, args.userId);
    const key = formatDateNumberToUTC(args.createdAt);

    const activityCounts: Record<string, number> = { ...userStats.activityCounts };
    activityCounts[key] = (activityCounts[key] ?? 0) + 1;

    await ctx.db.patch(userStats._id, {
      activityCounts,
      userMessagesCount: userStats.userMessagesCount + 1,
      lastUpdatedAt: Date.now(),
    });

    return null;
  },
});

export const incrementOnAssistantComplete = internalMutation({
  args: {
    userId: v.string(),
    modelUniqueId: v.string(),

    profileId: v.optional(v.id("profiles")),

    inputTokens: v.number(),
    outputTokens: v.number(),
    reasoningTokens: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userStats = await getOrCreateUserStats(ctx, args.userId);

    const normalizedModelId = tryGetModelData(args.modelUniqueId)?.id ?? args.modelUniqueId;
    const profileKey = args.profileId ?? "null";

    const modelRequestCounts: Record<string, number> = { ...userStats.modelRequestCounts };
    modelRequestCounts[normalizedModelId] = (modelRequestCounts[normalizedModelId] ?? 0) + 1;

    const aiProfileRequestCounts: Record<string, number> = { ...userStats.aiProfileRequestCounts };
    aiProfileRequestCounts[profileKey] = (aiProfileRequestCounts[profileKey] ?? 0) + 1;

    await ctx.db.patch(userStats._id, {
      assistantMessagesCount: userStats.assistantMessagesCount + 1,

      inputTokens: userStats.inputTokens + args.inputTokens,
      outputTokens: userStats.outputTokens + args.outputTokens,
      reasoningTokens: userStats.reasoningTokens + args.reasoningTokens,

      modelRequestCounts,
      aiProfileRequestCounts,
      lastUpdatedAt: Date.now(),
    });
  },
});

export const resetUserStats = internalMutation({
  args: { userId: v.string() },
  returns: v.id("user_stats"),
  handler: async (ctx, args) => {
    const userStats = await getOrCreateUserStats(ctx, args.userId);
    await ctx.db.patch(userStats._id, DEFAULT_USER_STATS);

    return userStats._id;
  },
});

export const migrateUserStatsFromMessages = internalAction({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userStatsId = await ctx.runMutation(internal.functions.user_stats.resetUserStats, {
      userId: args.userId,
    });

    let cursor: string | null = null;
    const userStats = structuredClone(DEFAULT_USER_STATS);

    const uniqueThreadIds = new Set<Id<"threads">>();

    for (;;) {
      const paginationMessages = await ctx.runQuery(
        internal.functions.messages.queryMessagesWithCursor,
        { cursor, userId: args.userId },
      );

      for (const message of paginationMessages.page) {
        uniqueThreadIds.add(message.threadId);
        const key = formatDateNumberToUTC(message.createdAt);

        if (message.role === "user") {
          userStats.userMessagesCount++;
          userStats.activityCounts[key] = (userStats.activityCounts[key] ?? 0) + 1;

          continue;
        }

        if (message.role === "assistant" && message.status === "complete") {
          userStats.assistantMessagesCount++;

          const metadata = message.metadata;
          if (!metadata) continue;
          if (metadata.finishReason === "aborted") continue;

          const modelId = metadata.model.request ?? "";
          userStats.modelRequestCounts[modelId] = (userStats.modelRequestCounts[modelId] ?? 0) + 1;

          const profileId = metadata.modelParams.profile ?? "null";
          userStats.aiProfileRequestCounts[profileId] =
            (userStats.aiProfileRequestCounts[profileId] ?? 0) + 1;

          userStats.inputTokens += metadata.usages.inputTokens ?? 0;
          userStats.outputTokens += metadata.usages.outputTokens ?? 0;
          userStats.reasoningTokens += metadata.usages.reasoningTokens ?? 0;
        }
      }

      if (paginationMessages.isDone) break;
      cursor = paginationMessages.continueCursor as string;
    }

    userStats.threadsCount = uniqueThreadIds.size;

    await ctx.runMutation(internal.functions.user_stats.patchUserStats, {
      userStatsId,
      updates: userStats,
    });

    return null;
  },
});

export const patchUserStats = internalMutation({
  args: {
    userStatsId: v.id("user_stats"),
    updates: v.object({
      threadsCount: v.number(),
      userMessagesCount: v.number(),
      assistantMessagesCount: v.number(),

      inputTokens: v.number(),
      outputTokens: v.number(),
      reasoningTokens: v.number(),

      activityCounts: v.record(v.string(), v.number()),
      modelRequestCounts: v.record(v.string(), v.number()),
      aiProfileRequestCounts: v.record(v.string(), v.number()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userStatsId, args.updates);
  },
});
