import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";

export const getStatistics = query({
  args: {},
  returns: v.object({
    stats: v.object({
      threads: v.number(),
      words: v.number(),
      messages: v.object({
        assistant: v.number(),
        user: v.number(),
      }),
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
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const statsDoc =
      (await ctx.db
        .query("user_stats")
        .withIndex("by_userId", (q) => q.eq("userId", user.subject))
        .unique()) ?? null;

    // Defaults when no stats exist yet
    const defaults = {
      stats: {
        threads: 0,
        words: 0,
        messages: { assistant: 0, user: 0 },
        wordsByRole: { assistant: 0, user: 0 },
      },
      modelCounts: {} as Record<string, number>,
      threadCounts: {} as Record<string, number>,
      activityCounts: {} as Record<string, number>,
      aiProfileCounts: {} as Record<string, number>,
    };

    // Safely parse optional wordsByRole for backward-compatible docs
    const wr = (() => {
      const maybe = statsDoc?.stats?.wordsByRole;
      if (
        typeof maybe === "object" &&
        maybe !== null &&
        typeof maybe.assistant === "number" &&
        typeof maybe.user === "number"
      ) {
        return { assistant: maybe.assistant, user: maybe.user };
      }
      return { assistant: 0, user: 0 };
    })();

    const s = statsDoc
      ? {
          stats: {
            threads: statsDoc.stats.threads,
            words: statsDoc.stats.words,
            messages: {
              assistant: statsDoc.stats.messages.assistant,
              user: statsDoc.stats.messages.user,
            },
            wordsByRole: wr,
          },
          modelCounts: statsDoc.modelCounts,
          threadCounts: statsDoc.threadCounts,
          activityCounts: statsDoc.activityCounts,
          aiProfileCounts: statsDoc.aiProfileCounts,
        }
      : defaults;

    // modelRank from pre-aggregated counts
    const modelRank = Object.entries(s.modelCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // threadRank: resolve names
    const threadEntries = Object.entries(s.threadCounts);
    const threadIds: Array<Id<"threads">> = threadEntries.map(
      ([threadId]) => threadId as Id<"threads">,
    );

    const threadDocs: Array<Doc<"threads"> | null> = await Promise.all(
      threadIds.map(async (id) => ctx.db.get(id)),
    );

    const threadRank = threadEntries
      .map(([, value], idx) => {
        const id = threadIds[idx];
        const t = threadDocs[idx];
        if (!id) return null;
        return { id, name: t?.title ?? "Unknown", value };
      })
      .filter((x): x is { id: Id<"threads">; name: string; value: number } => x !== null)
      .sort((a, b) => b.value - a.value);

    // Build activity chart from user messages only (current year)
    function dayKey(ts: number): string {
      const d = new Date(ts);
      const iso = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      ).toISOString();
      const day = iso.split("T")[0];
      return day ?? "";
    }

    const now = Date.now();
    const nowDate = new Date(now);
    const yearStartMs = Date.UTC(nowDate.getUTCFullYear(), 0, 1);

    const activityCounts: Record<string, number> = {};

    // Collect all threads for this user
    const userThreads = await ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", user.subject))
      .collect();

    // For each thread, count only 'user' role messages in current year
    for (const t of userThreads) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_threadId", (q) => q.eq("threadId", t._id))
        .collect();

      for (const m of messages) {
        if (m.role === "user" && m.createdAt >= yearStartMs && m.createdAt <= now) {
          const day = dayKey(m.createdAt);
          activityCounts[day] = (activityCounts[day] ?? 0) + 1;
        }
      }
    }

    const activity = Object.entries(activityCounts).map(([day, value]) => ({
      day,
      value,
    }));

    // aiProfileRank: map ids to names for current user
    const profiles = await ctx.db
      .query("ai_profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.subject))
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
