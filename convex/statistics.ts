import { type QueryCtx, query } from "./_generated/server";
import { type Doc } from "./_generated/dataModel";

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
          acc[m.model] = (acc[m.model] || 0) + 1;
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

    return {
      stats: [
        { name: "Threads", value: threads.length },
        { name: "Messages", value: messages.length },
        { name: "Total Words", value: totalWords },
      ],
      modelRank: Object.entries(modelRank)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ name, value })),
      threadRank: threadRank.sort((a, b) => b.value - a.value),
    };
  },
});
