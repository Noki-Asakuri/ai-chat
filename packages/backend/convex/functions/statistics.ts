import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { authenticatedQuery } from "../components";

export const getStatistics = authenticatedQuery({
  args: {},
  returns: v.object({
    stats: v.object({
      threads: v.number(),
      messages: v.object({
        assistant: v.number(),
        user: v.number(),
      }),
      tokens: v.optional(
        v.object({
          input: v.number(),
          output: v.number(),
          reasoning: v.number(),
          total: v.number(),
        }),
      ),
      tokensByRole: v.optional(
        v.object({
          assistant: v.number(),
          user: v.number(),
        }),
      ),

      // Legacy word-based stats (deprecated)
      words: v.optional(v.number()),
      wordsByRole: v.optional(
        v.object({
          assistant: v.number(),
          user: v.number(),
        }),
      ),
    }),
    modelRank: v.array(v.object({ name: v.string(), value: v.number() })),
    threadRank: v.array(v.object({ id: v.id("threads"), name: v.string(), value: v.number() })),
    activity: v.array(v.object({ day: v.string(), value: v.number() })),
    aiProfileRank: v.array(v.object({ name: v.string(), value: v.number() })),
  }),
  handler: async (ctx) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const statsDoc =
      (await ctx.db
        .query("user_stats")
        .withIndex("by_userId", (q) => q.eq("userId", user.userId))
        .unique()) ?? null;

    function isRecord(value: unknown): value is Record<string, unknown> {
      return typeof value === "object" && value !== null;
    }

    function readNumber(value: unknown): number {
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    }

    function readTokenTotals(value: unknown): {
      input: number;
      output: number;
      reasoning: number;
      total: number;
    } {
      if (!isRecord(value)) return { input: 0, output: 0, reasoning: 0, total: 0 };
      const input = readNumber(value["input"]);
      const output = readNumber(value["output"]);
      const reasoning = readNumber(value["reasoning"]);
      const total = readNumber(value["total"]);
      return { input, output, reasoning, total };
    }

    function readRoleTotals(value: unknown): { assistant: number; user: number } {
      if (!isRecord(value)) return { assistant: 0, user: 0 };
      return { assistant: readNumber(value["assistant"]), user: readNumber(value["user"]) };
    }

    type StatsResponse = {
      stats: {
        threads: number;
        messages: { assistant: number; user: number };
        tokens: { input: number; output: number; reasoning: number; total: number };
        tokensByRole: { assistant: number; user: number };

        // legacy (deprecated)
        words: number;
        wordsByRole: { assistant: number; user: number };
      };
      modelCounts: Record<string, number>;
      threadCounts: Record<Id<"threads">, number>;
      activityCounts: Record<string, number>;
      aiProfileCounts: Record<string, number>;
    };

    // Defaults when no stats exist yet
    const defaults: StatsResponse = {
      stats: {
        threads: 0,
        messages: { assistant: 0, user: 0 },
        tokens: { input: 0, output: 0, reasoning: 0, total: 0 },
        tokensByRole: { assistant: 0, user: 0 },

        // legacy (deprecated)
        words: 0,
        wordsByRole: { assistant: 0, user: 0 },
      },
      modelCounts: {},
      threadCounts: {},
      activityCounts: {},
      aiProfileCounts: {},
    };

    const s: StatsResponse = (() => {
      if (!statsDoc) return defaults;

      const statsRecord: Record<string, unknown> = isRecord(statsDoc.stats) ? statsDoc.stats : {};

      return {
        stats: {
          threads: statsDoc.stats.threads,
          messages: {
            assistant: statsDoc.stats.messages.assistant,
            user: statsDoc.stats.messages.user,
          },

          tokens: readTokenTotals(statsRecord["tokens"]),
          tokensByRole: readRoleTotals(statsRecord["tokensByRole"]),

          // legacy (deprecated)
          words: readNumber(statsRecord["words"]),
          wordsByRole: readRoleTotals(statsRecord["wordsByRole"]),
        },
        modelCounts: statsDoc.modelCounts,
        threadCounts: statsDoc.threadCounts,
        activityCounts: statsDoc.activityCounts,
        aiProfileCounts: statsDoc.aiProfileCounts,
      };
    })();

    // modelRank from pre-aggregated counts
    const modelRank = Object.entries(s.modelCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // threadRank: resolve titles (avoid `Id` casts by using real thread docs as the source of truth)
    const threadEntries = Object.entries(s.threadCounts).sort((a, b) => b[1] - a[1]);

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    const threadById: Record<string, Doc<"threads">> = {};
    for (const t of threads) {
      threadById[t._id] = t;
    }

    const threadRank = threadEntries
      .map(([threadId, value]) => {
        const t = threadById[threadId];
        if (!t) return null;
        return { id: t._id, name: t.title ?? "Unknown", value };
      })
      .filter((x): x is { id: Id<"threads">; name: string; value: number } => x !== null);

    // Activity: stored user message counts by day (already deduped and cheap to fetch).
    const activity = Object.entries(s.activityCounts).map(([day, value]) => ({ day, value }));

    // aiProfileRank: map ids to names for current user
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    const idToName: Record<string, string> = {};
    for (const p of profiles) idToName[p._id] = p.name;

    const aiProfileRank = Object.entries(s.aiProfileCounts)
      .map(([key, value]) => {
        const name = key === "null" ? "No profile" : (idToName[key] ?? "Unknown profile");
        return { name, value };
      })
      .sort((a, b) => b.value - a.value);

    return {
      stats: s.stats,
      modelRank,
      threadRank,
      activity,
      aiProfileRank,
    };
  },
});
