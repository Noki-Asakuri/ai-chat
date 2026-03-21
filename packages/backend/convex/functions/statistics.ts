import { v } from "convex/values";
import { tryGetModelData } from "@ai-chat/shared/chat/models";

import { authenticatedQuery } from "../components";

function normalizeActivityDay(day: string): string | null {
  const isoDayPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDayPattern.test(day)) return day;

  const legacyDayMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(day);
  if (!legacyDayMatch) return null;

  const [, date, month, year] = legacyDayMatch;
  return `${year}-${month}-${date}`;
}

function normalizeActivity(
  activityCounts: Record<string, number>,
): Array<{ day: string; value: number }> {
  const normalizedActivity: Record<string, number> = {};

  for (const [day, value] of Object.entries(activityCounts)) {
    const normalizedDay = normalizeActivityDay(day);
    if (!normalizedDay) continue;

    normalizedActivity[normalizedDay] = (normalizedActivity[normalizedDay] ?? 0) + value;
  }

  return Object.entries(normalizedActivity)
    .map(([day, value]) => ({ day, value }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

export const getStatistics = authenticatedQuery({
  args: {
    year: v.optional(v.number()),
  },
  returns: v.object({
    threadsCount: v.number(),
    userMessagesCount: v.number(),
    assistantMessagesCount: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    reasoningTokens: v.number(),
    modelRank: v.array(v.object({ name: v.string(), value: v.number() })),
    activity: v.array(v.object({ day: v.string(), value: v.number() })),
    aiProfileRank: v.array(v.object({ name: v.string(), value: v.number() })),
  }),
  handler: async (ctx, args) => {
    const user = ctx.user;

    const now = new Date();
    const selectedYear = args.year ?? now.getUTCFullYear();
    const startOfYear = Date.UTC(selectedYear, 0, 1);
    const startOfNextYear = Date.UTC(selectedYear + 1, 0, 1);

    const statsDoc = await ctx.db
      .query("user_stats")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique();

    const yearMessages = await ctx.db
      .query("messages")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", user.userId).gte("createdAt", startOfYear).lt("createdAt", startOfNextYear),
      )
      .collect();

    const yearModelRequestCounts: Record<string, number> = {};
    const yearProfileRequestCounts: Record<string, number> = {};

    for (const message of yearMessages) {
      if (message.role !== "assistant") continue;
      if (message.status !== "complete") continue;

      const metadata = message.metadata;
      if (!metadata) continue;
      if (metadata.finishReason === "aborted") continue;

      const modelUniqueId = metadata.model.request.trim();
      if (modelUniqueId.length > 0) {
        const normalizedModelId = tryGetModelData(modelUniqueId)?.id ?? modelUniqueId;
        yearModelRequestCounts[normalizedModelId] =
          (yearModelRequestCounts[normalizedModelId] ?? 0) + 1;
      }

      const aiProfileKey = metadata.modelParams.profile ?? "null";
      yearProfileRequestCounts[aiProfileKey] = (yearProfileRequestCounts[aiProfileKey] ?? 0) + 1;
    }

    const modelRank = Object.entries(yearModelRequestCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const activity = normalizeActivity(statsDoc?.activityCounts ?? {});

    // aiProfileRank: map ids to names for current user
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    const idToName: Record<string, string> = {};
    for (const p of profiles) idToName[p._id] = p.name;

    const aiProfileRank = Object.entries(yearProfileRequestCounts)
      .flatMap(([key, value]) => {
        if (key === "null") return [{ name: "No profile", value }];

        const name = idToName[key];
        if (!name) return [];

        return [{ name, value }];
      })
      .sort((a, b) => b.value - a.value);

    return {
      threadsCount: statsDoc?.threadsCount ?? 0,
      userMessagesCount: statsDoc?.userMessagesCount ?? 0,
      assistantMessagesCount: statsDoc?.assistantMessagesCount ?? 0,
      inputTokens: statsDoc?.inputTokens ?? 0,
      outputTokens: statsDoc?.outputTokens ?? 0,
      reasoningTokens: statsDoc?.reasoningTokens ?? 0,
      modelRank,
      activity,
      aiProfileRank,
    };
  },
});
