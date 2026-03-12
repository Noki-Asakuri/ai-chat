// oxlint-disable no-unused-vars
import { Migrations } from "@convex-dev/migrations";
import { tryGetModelData } from "@ai-chat/shared/chat/models";

import { components, internal } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";

import { DEFAULT_THREAD_MODEL, mergeUserPreferences } from "./functions/users";

/**
 * Initialize migrations component with DataModel for proper typing.
 */
export const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Generic runner you can use to run a single migration by name:
 * Example:
 *   bunx convex run migrations:run '{fn:"migrations:backfillMessages"}'
 */
export const run = migrations.runner();

type TokenTotals = {
  input: number;
  output: number;
  reasoning: number;
  total: number;
};

type UserStatsReplacement = {
  userId: string;
  stats: {
    threads: number;
    messages: { assistant: number; user: number };
    tokens: TokenTotals;
    tokensByRole: { assistant: number; user: number };
  };
  activityCounts: Record<string, number>;
  modelRequestCounts: Record<string, number>;
  aiProfileRequestCounts: Record<string, number>;
  lastUpdatedAt: number;
};

function dayKey(ts: number): string {
  const date = new Date(ts);
  const iso = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
  return iso.split("T")[0] ?? "";
}

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

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

function createEmptyUserStats(userId: string): UserStatsReplacement {
  return {
    userId,
    stats: {
      threads: 0,
      messages: { assistant: 0, user: 0 },
      tokens: { input: 0, output: 0, reasoning: 0, total: 0 },
      tokensByRole: { assistant: 0, user: 0 },
    },
    activityCounts: {},
    modelRequestCounts: {},
    aiProfileRequestCounts: {},
    lastUpdatedAt: Date.now(),
  };
}

function getThreadModelConfigFromMessages(messages: Doc<"messages">[]): {
  latestModel: string;
  latestModelParams: NonNullable<Doc<"threads">["latestModelParams"]>;
} | null {
  for (const message of messages) {
    if (message.role !== "assistant") continue;

    const latestModel = message.metadata?.model.request?.trim();
    if (!latestModel) continue;

    const modelParams = message.metadata?.modelParams;
    if (!modelParams) continue;

    return {
      latestModel,
      latestModelParams: {
        effort: modelParams.effort,
        webSearch: modelParams.webSearch,
        profile: modelParams.profile ?? null,
      },
    };
  }

  return null;
}

function finalizeStreamingParts(parts: Doc<"messages">["parts"]): {
  changed: boolean;
  parts: Doc<"messages">["parts"];
} {
  let changed = false;
  const nextParts: Array<Doc<"messages">["parts"][number]> = [];

  for (const part of parts) {
    if ((part.type === "text" || part.type === "reasoning") && part.state === "streaming") {
      nextParts.push({ ...part, state: "done" });
      changed = true;
      continue;
    }

    nextParts.push(part);
  }

  return { changed, parts: changed ? nextParts : parts };
}

export const backfillThreadModelConfig = migrations.define({
  table: "threads",
  migrateOne: async (ctx, thread) => {
    if (thread.latestModel && thread.latestModelParams) {
      return;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .collect();

    const configFromMessages = getThreadModelConfigFromMessages(messages);

    if (configFromMessages) {
      await ctx.db.patch(thread._id, configFromMessages);
      return;
    }

    await ctx.db.patch(thread._id, {
      latestModel: DEFAULT_THREAD_MODEL,
      latestModelParams: {
        effort: "medium",
        webSearch: false,
        profile: null,
      },
    });
  },
});

export const backfillUserPreferencesShape = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    await ctx.db.patch(user._id, { preferences: mergeUserPreferences(user.preferences) });
  },
});

export const finalizeStreamingMessageParts = migrations.define({
  table: "messages",
  migrateOne: async (ctx, message) => {
    if (!Array.isArray(message.parts)) return;

    const { changed, parts } = finalizeStreamingParts(message.parts);
    if (!changed) return;

    await ctx.db.patch(message._id, { parts });
  },
});

export const backfillUserStatsFromMessages = migrations.define({
  table: "user_stats",
  migrateOne: async (ctx, userStats) => {
    const nextStats = createEmptyUserStats(userStats.userId);

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", userStats.userId))
      .collect();

    nextStats.stats.threads = threads.length;

    for (const thread of threads) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_userId_threadId", (q) =>
          q.eq("userId", userStats.userId).eq("threadId", thread._id),
        )
        .order("asc")
        .collect();

      let previousInputTokens = 0;

      for (const message of messages) {
        if (message.role === "user") {
          nextStats.stats.messages.user += 1;

          const day = dayKey(message.createdAt);
          nextStats.activityCounts[day] = (nextStats.activityCounts[day] ?? 0) + 1;
          continue;
        }

        if (message.status !== "complete") continue;

        const metadata = message.metadata;
        if (!metadata) continue;
        if (metadata.finishReason === "aborted") continue;

        nextStats.stats.messages.assistant += 1;

        const inputTokens = metadata.usages.inputTokens ?? 0;
        const outputTokens = metadata.usages.outputTokens ?? 0;
        const reasoningTokens = metadata.usages.reasoningTokens ?? 0;
        const added = makeTokenTotals(
          inputTokens - previousInputTokens,
          outputTokens,
          reasoningTokens,
        );
        previousInputTokens = inputTokens;

        nextStats.stats.tokens = addTokenTotals(nextStats.stats.tokens, added);
        nextStats.stats.tokensByRole = {
          assistant: nextStats.stats.tokensByRole.assistant + added.output + added.reasoning,
          user: nextStats.stats.tokensByRole.user + added.input,
        };

        const modelUniqueId = metadata.model.request.trim();
        if (modelUniqueId.length > 0) {
          const normalizedModelId = tryGetModelData(modelUniqueId)?.id ?? modelUniqueId;
          nextStats.modelRequestCounts[normalizedModelId] =
            (nextStats.modelRequestCounts[normalizedModelId] ?? 0) + 1;
        }

        const aiProfileKey = metadata.modelParams.profile ?? "null";
        nextStats.aiProfileRequestCounts[aiProfileKey] =
          (nextStats.aiProfileRequestCounts[aiProfileKey] ?? 0) + 1;
      }
    }

    nextStats.lastUpdatedAt = Date.now();
    await ctx.db.replace("user_stats", userStats._id, nextStats);
  },
});

export const backfillAssistantStatsTrackedAt = migrations.define({
  table: "messages",
  migrateOne: async (ctx, message) => {
    if (message.role !== "assistant") return;

    const metadata = message.metadata;
    const shouldTrack =
      message.status === "complete" && metadata && metadata.finishReason !== "aborted";

    if (!shouldTrack) {
      if (message.statsTrackedAt === undefined) return;
      await ctx.db.patch("messages", message._id, { statsTrackedAt: undefined });
      return;
    }

    if (message.statsTrackedAt !== undefined) return;

    await ctx.db.patch("messages", message._id, {
      statsTrackedAt: message.updatedAt,
    });
  },
});

export const runBackfillThreadModelConfig = migrations.runner([
  internal.migrations.backfillThreadModelConfig,
]);

export const runBackfillUserPreferencesShape = migrations.runner([
  internal.migrations.backfillUserPreferencesShape,
]);

export const runFinalizeStreamingMessageParts = migrations.runner([
  internal.migrations.finalizeStreamingMessageParts,
]);

export const runBackfillUserStatsFromMessages = migrations.runner([
  internal.migrations.backfillUserStatsFromMessages,
  internal.migrations.backfillAssistantStatsTrackedAt,
]);
