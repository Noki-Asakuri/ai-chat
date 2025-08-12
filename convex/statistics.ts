import { type QueryCtx, query } from "./_generated/server";
import { type Doc } from "./_generated/dataModel";

import { getModelData } from "../src/lib/chat/models";

export const getStatistics = query({
  handler: async (ctx: QueryCtx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", user.subject))
      .collect();

    const messagesFromDatabase = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", user.subject))
      .collect();

    const totalWords = messagesFromDatabase.reduce(
      (acc: number, m: Doc<"messages">) => acc + m.content.trim().split(/\s+/).length,
      0,
    );

    const modelRank = messagesFromDatabase.reduce(
      (acc: Record<string, number>, m: Doc<"messages">) => {
        if (m.role === "assistant" && m.model) {
          const id = getModelData(m.model).id;
          acc[id] = (acc[id] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const threadMessageCounts = messagesFromDatabase.reduce(
      (acc: Record<string, number>, m: Doc<"messages">) => {
        acc[m.threadId] = (acc[m.threadId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const threadRank = threads.map((t) => ({
      id: t._id,
      name: t.title,
      value: threadMessageCounts[t._id] || 0,
    }));

    const activityMap = messagesFromDatabase.reduce(
      (acc: Record<string, number>, m: Doc<"messages">) => {
        const parts = new Date(m._creationTime).toISOString().split("T");
        const day = parts[0];
        if (day) {
          const prev = acc[day] ?? 0;
          acc[day] = prev + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const activity = Object.entries(activityMap).map(([day, value]) => ({ day, value }));

    const messages = messagesFromDatabase.reduce(
      (acc: { assistant: number; user: number }, m: Doc<"messages">) => {
        if (m.role === "assistant") acc.assistant++;
        if (m.role === "user") acc.user++;
        return acc;
      },
      { assistant: 0, user: 0 },
    );

    const aiProfileCountMap = messagesFromDatabase.reduce(
      (acc: Record<string, number>, m: Doc<"messages">) => {
        if (m.role !== "assistant") return acc;

        const key = m.metadata?.aiProfileId ?? "null";
        acc[key] = (acc[key] ?? 0) + 1;

        return acc;
      },
      {} as Record<string, number>,
    );

    // Load profile names for the current user to resolve ids
    const profiles = await ctx.db
      .query("ai_profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.subject))
      .collect();

    const idToName: Record<string, string> = {};
    for (const p of profiles) idToName[p._id] = p.name;

    const aiProfileRank = Object.entries(aiProfileCountMap)
      .map(([key, value]) => {
        const name = key === "null" ? "No profile" : (idToName[key] ?? "Unknown profile");
        return { name, value };
      })
      .sort((a, b) => b.value - a.value);

    return {
      stats: {
        threads: threads.length,
        words: totalWords,
        messages,
      },
      modelRank: Object.entries(modelRank)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ name, value })),
      threadRank: threadRank.sort((a, b) => b.value - a.value),
      activity,
      aiProfileRank,
    };
  },
});
