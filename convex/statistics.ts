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

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", user.subject))
      .collect();

    const totalWords = messages.reduce(
      (acc: number, m: Doc<"messages">) => acc + m.content.split(" ").length,
      0,
    );

    const modelRank = messages.reduce(
      (acc: Record<string, number>, m: Doc<"messages">) => {
        if (m.role === "assistant" && m.model) {
          const id = getModelData(m.model).id;
          acc[id] = (acc[id] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const threadRank = threads.map((t) => ({
      id: t._id,
      name: t.title,
      value: messages.filter((m) => m.threadId === t._id).length,
    }));

    const activity = messages.reduce(
      (acc: { day: string; value: number }[], m: Doc<"messages">) => {
        const date = new Date(m._creationTime).toISOString().split("T")[0];
        const existing = acc.find((d) => d.day === date);

        if (existing) existing.value += 1;
        else acc.push({ day: date, value: 1 });

        return acc;
      },
      [],
    );

    return {
      stats: {
        threads: threads.length,
        words: totalWords,
        messages: {
          assistant: messages.filter((m) => m.role === "assistant").length,
          user: messages.filter((m) => m.role === "user").length,
        },
      },
      modelRank: Object.entries(modelRank)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ name, value })),
      threadRank: threadRank.sort((a, b) => b.value - a.value),
      activity,
    };
  },
});
