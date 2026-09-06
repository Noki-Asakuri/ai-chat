/* oxlint-disable no-await-in-loop -- Statistics updates and profile lookups run inside a Convex transaction. */
import { v } from "convex/values";
import { tryGetModelData } from "@ai-chat/shared/chat/models";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { authenticatedQuery } from "../components";

const emptyTotals = {
  threadsCount: 0,
  userMessagesCount: 0,
  assistantMessagesCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  unreportedInputCount: 0,
  unreportedOutputCount: 0,
  legacyResponsesCount: 0,
};

const totalKeys = [
  "threadsCount",
  "userMessagesCount",
  "assistantMessagesCount",
  "inputTokens",
  "outputTokens",
  "reasoningTokens",
  "unreportedInputCount",
  "unreportedOutputCount",
  "legacyResponsesCount",
] as const satisfies ReadonlyArray<keyof typeof emptyTotals>;

const totalsValidator = v.object({
  threadsCount: v.number(),
  userMessagesCount: v.number(),
  assistantMessagesCount: v.number(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  reasoningTokens: v.number(),
  unreportedInputCount: v.number(),
  unreportedOutputCount: v.number(),
  legacyResponsesCount: v.number(),
});

async function incrementMonth(
  ctx: MutationCtx,
  userId: string,
  timestamp: number,
  counts: Partial<typeof emptyTotals>,
  modelId?: string,
  profileId?: string,
) {
  const month = new Date(timestamp).toISOString().slice(0, 7);
  const existing = await ctx.db
    .query("monthlyStatistics")
    .withIndex("by_userId_month", (q) => q.eq("userId", userId).eq("month", month))
    .unique();
  const totals = { ...emptyTotals };
  for (const key of totalKeys) {
    totals[key] = (existing?.[key] ?? 0) + (counts[key] ?? 0);
  }
  const modelCounts = { ...existing?.modelCounts };
  const modelTokenCounts = { ...existing?.modelTokenCounts };
  const profileCounts = { ...existing?.profileCounts };
  if (modelId) modelCounts[modelId] = (modelCounts[modelId] ?? 0) + 1;
  if (modelId)
    modelTokenCounts[modelId] =
      (modelTokenCounts[modelId] ?? 0) + (counts.inputTokens ?? 0) + (counts.outputTokens ?? 0);
  if (profileId) profileCounts[profileId] = (profileCounts[profileId] ?? 0) + 1;
  const data = { userId, month, ...totals, modelCounts, modelTokenCounts, profileCounts };
  if (existing) await ctx.db.patch(existing._id, data);
  else await ctx.db.insert("monthlyStatistics", data);
}

// Record creation, not current inventory: deleting a conversation keeps its usage.
export async function recordStatisticsThread(ctx: MutationCtx, thread: Doc<"threads">) {
  if (thread.statisticsRecorded) return;
  await incrementMonth(ctx, thread.userId, thread._creationTime, { threadsCount: 1 });
  await ctx.db.patch(thread._id, { statisticsRecorded: true });
}

// The marker is written with the aggregate, making migration and completion retries idempotent.
export async function recordStatisticsMessage(ctx: MutationCtx, message: Doc<"messages">) {
  if (message.statisticsRecorded) return;
  if (message.role === "user") {
    await incrementMonth(ctx, message.userId, message.createdAt, { userMessagesCount: 1 });
  } else {
    if (message.status !== "complete" || message.metadata?.finishReason === "aborted") return;
    const usage = message.metadata?.usages;
    const legacy = usage?.inputReported === undefined;
    const inputReported = usage?.inputReported ?? (usage?.inputTokens ?? 0) > 0;
    const outputReported =
      usage?.outputReported ?? (usage?.outputTokens ?? 0) + (usage?.reasoningTokens ?? 0) > 0;
    const requestedModel = message.metadata?.model.request;
    const modelId = requestedModel ? (tryGetModelData(requestedModel)?.id ?? requestedModel) : "unknown";
    await incrementMonth(
      ctx,
      message.userId,
      legacy ? message.createdAt : message.updatedAt,
      {
        assistantMessagesCount: 1,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.totalOutputTokens ?? (usage?.outputTokens ?? 0) + (usage?.reasoningTokens ?? 0),
        reasoningTokens: usage?.reasoningTokens ?? 0,
        unreportedInputCount: inputReported ? 0 : 1,
        unreportedOutputCount: outputReported ? 0 : 1,
        legacyResponsesCount: legacy ? 1 : 0,
      },
      modelId,
      message.metadata?.modelParams.profile ?? "none",
    );
  }
  await ctx.db.patch(message._id, { statisticsRecorded: true, modelTokensRecorded: true });
}

// Legacy copies share the branch's creation millisecond, even after replacement.
export async function isHistoricalBranchCopy(ctx: MutationCtx, message: Doc<"messages">) {
  const thread = await ctx.db.get("threads", message.threadId);
  if (!thread?.branchedFrom || Math.floor(message._creationTime) !== Math.floor(thread._creationTime)) {
    return false;
  }

  if (message.role === "user") return true;
  if ((message.statsTrackedAt ?? 0) > thread._creationTime) return false;

  const retry = await ctx.db
    .query("retryAttempts")
    .withIndex("by_preparedAssistantMessageId", (q) => q.eq("preparedAssistantMessageId", message._id))
    .first();

  return retry === null;
}

// Add recoverable historical model tokens without replaying message or token totals.
export async function backfillModelTokens(ctx: MutationCtx, message: Doc<"messages">) {
  if (
    message.modelTokensRecorded ||
    !message.statisticsRecorded ||
    message.role !== "assistant" ||
    message.status !== "complete" ||
    message.metadata?.finishReason === "aborted"
  )
    return;
  if (await isHistoricalBranchCopy(ctx, message)) {
    await ctx.db.patch(message._id, { modelTokensRecorded: true });
    return;
  }
  const usage = message.metadata?.usages;
  const timestamp = usage?.inputReported === undefined ? message.createdAt : message.updatedAt;
  const month = new Date(timestamp).toISOString().slice(0, 7);
  const existing = await ctx.db
    .query("monthlyStatistics")
    .withIndex("by_userId_month", (q) => q.eq("userId", message.userId).eq("month", month))
    .unique();
  if (!existing) return;
  const requestedModel = message.metadata?.model.request;
  const modelId = requestedModel ? (tryGetModelData(requestedModel)?.id ?? requestedModel) : "unknown";
  const tokens =
    (usage?.inputTokens ?? 0) +
    (usage?.totalOutputTokens ?? (usage?.outputTokens ?? 0) + (usage?.reasoningTokens ?? 0));
  const modelTokenCounts = { ...existing.modelTokenCounts };
  modelTokenCounts[modelId] = (modelTokenCounts[modelId] ?? 0) + tokens;
  await ctx.db.patch(existing._id, { modelTokenCounts });
  await ctx.db.patch(message._id, { modelTokensRecorded: true });
}

export const getStatistics = authenticatedQuery({
  args: { year: v.optional(v.number()) },
  returns: v.object({
    totals: totalsValidator,
    activity: v.array(v.object({ period: v.string(), ...totalsValidator.fields })),
    dailyActivity: v.array(v.object({ day: v.string(), value: v.number() })),
    years: v.array(v.number()),
    modelRank: v.array(v.object({ id: v.string(), name: v.string(), value: v.number(), tokens: v.number() })),
    aiProfileRank: v.array(v.object({ id: v.string(), name: v.string(), value: v.number() })),
    historyReady: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const currentYear = new Date().getUTCFullYear();
    if (
      args.year !== undefined &&
      (!Number.isInteger(args.year) || args.year < 1970 || args.year > currentYear)
    ) {
      throw new Error("Invalid statistics year");
    }
    // ponytail: one compact row per month, capped at 100 years; paginate if that horizon grows.
    const months = await ctx.db
      .query("monthlyStatistics")
      .withIndex("by_userId_month", (q) => q.eq("userId", ctx.user.userId))
      .take(1201);
    if (months.length > 1200) throw new Error("Statistics history exceeds the supported range");
    const years = new Set([currentYear]);
    const userStats = await ctx.db
      .query("user_stats")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user.userId))
      .unique();
    const dailyCounts = new Map<string, number>();
    for (const [date, value] of Object.entries(userStats?.activityCounts ?? {})) {
      const legacyDay = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
      const day = legacyDay ? `${legacyDay[3]}-${legacyDay[2]}-${legacyDay[1]}` : date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      years.add(Number(day.slice(0, 4)));
      if (args.year !== undefined && Number(day.slice(0, 4)) !== args.year) continue;
      dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + value);
    }
    const totals = { ...emptyTotals };
    const activity = new Map<string, typeof emptyTotals>();
    const models = new Map<string, number>();
    const modelTokens = new Map<string, number>();
    const profiles = new Map<string, number>();
    for (const month of months) years.add(Number(month.month.slice(0, 4)));
    if (args.year !== undefined) {
      const lastMonth = args.year === currentYear ? new Date().getUTCMonth() + 1 : 12;
      for (let month = 1; month <= lastMonth; month++) {
        activity.set(`${args.year}-${String(month).padStart(2, "0")}`, { ...emptyTotals });
      }
    } else {
      const firstYear = Math.min(...years);
      for (let year = firstYear; year <= currentYear; year++) activity.set(String(year), { ...emptyTotals });
    }
    for (const month of months) {
      if (args.year !== undefined && Number(month.month.slice(0, 4)) !== args.year) continue;
      const period = args.year === undefined ? month.month.slice(0, 4) : month.month;
      const point = activity.get(period) ?? { ...emptyTotals };
      for (const key of totalKeys) {
        totals[key] += month[key];
        point[key] += month[key];
      }
      activity.set(period, point);
      for (const [id, count] of Object.entries(month.modelCounts))
        models.set(id, (models.get(id) ?? 0) + count);
      for (const [id, count] of Object.entries(month.modelTokenCounts ?? {}))
        modelTokens.set(id, (modelTokens.get(id) ?? 0) + count);
      for (const [id, count] of Object.entries(month.profileCounts))
        profiles.set(id, (profiles.get(id) ?? 0) + count);
    }
    const aiProfileRank = [];
    for (const [id, value] of profiles) {
      const profileId = ctx.db.normalizeId("profiles", id);
      const profile = profileId ? await ctx.db.get(profileId) : null;
      const name =
        id === "none" ? "No profile" : profile?.userId === ctx.user.userId ? profile.name : "Deleted profile";
      aiProfileRank.push({ id, name, value });
    }
    return {
      totals,
      dailyActivity: Array.from(dailyCounts, ([day, value]) => ({ day, value })).toSorted((a, b) =>
        a.day.localeCompare(b.day),
      ),
      activity: Array.from(activity, ([period, point]) => ({ period, ...point })).toSorted((a, b) =>
        a.period.localeCompare(b.period),
      ),
      years: Array.from(years).toSorted((a, b) => b - a),
      modelRank: Array.from(models, ([id, value]) => ({
        id,
        name: tryGetModelData(id)?.display.name ?? id,
        value,
        tokens: modelTokens.get(id) ?? 0,
      })).toSorted((a, b) => b.value - a.value),
      aiProfileRank: aiProfileRank.toSorted((a, b) => b.value - a.value),
      historyReady: ctx.user.statisticsHistoryReady ?? false,
    };
  },
});
