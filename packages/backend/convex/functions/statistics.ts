import { v } from "convex/values";

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
    }),
    modelRank: v.array(v.object({ name: v.string(), value: v.number() })),
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
      };
      activityCounts: Record<string, number>;
      modelRequestCounts: Record<string, number>;
      aiProfileRequestCounts: Record<string, number>;
    };

    // Defaults when no stats exist yet
    const defaults: StatsResponse = {
      stats: {
        threads: 0,
        messages: { assistant: 0, user: 0 },
        tokens: { input: 0, output: 0, reasoning: 0, total: 0 },
        tokensByRole: { assistant: 0, user: 0 },
      },
      activityCounts: {},
      modelRequestCounts: {},
      aiProfileRequestCounts: {},
    };

    function readCountRecord(value: unknown): Record<string, number> {
      if (!isRecord(value)) return {};

      const result: Record<string, number> = {};
      for (const [key, count] of Object.entries(value)) {
        result[key] = readNumber(count);
      }

      return result;
    }

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
        },
        activityCounts: readCountRecord(statsDoc.activityCounts),
        modelRequestCounts: readCountRecord(statsDoc.modelRequestCounts),
        aiProfileRequestCounts: readCountRecord(statsDoc.aiProfileRequestCounts),
      };
    })();

    const modelRank = Object.entries(s.modelRequestCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const activity = Object.entries(s.activityCounts)
      .map(([day, value]) => ({ day, value }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // aiProfileRank: map ids to names for current user
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    const idToName: Record<string, string> = {};
    for (const p of profiles) idToName[p._id] = p.name;

    const aiProfileRank = Object.entries(s.aiProfileRequestCounts)
      .flatMap(([key, value]) => {
        if (key === "null") return [{ name: "No profile", value }];

        const name = idToName[key];
        if (!name) return [];

        return [{ name, value }];
      })
      .sort((a, b) => b.value - a.value);

    return {
      stats: s.stats,
      modelRank,
      activity,
      aiProfileRank,
    };
  },
});
