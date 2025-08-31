import { internalMutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { getModelData } from "../../src/lib/chat/models";

function dayKey(ts: number): string {
  const d = new Date(ts);
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  return iso.split("T")[0] ?? "";
}

function wordCount(text: string): number {
  const t = text.trim();
  if (t.length === 0) return 0;
  const parts = t.split(/\s+/);
  return parts.length;
}

async function getOrCreate(ctx: MutationCtx, userId: string): Promise<Doc<"user_stats">> {
  const existing = await ctx.db
    .query("user_stats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (existing) return existing;

  const now = Date.now();
  const id = await ctx.db.insert("user_stats", {
    userId,
    stats: {
      threads: 0,
      words: 0,
      messages: { assistant: 0, user: 0 },
    },
    modelCounts: {},
    threadCounts: {},
    activityCounts: {},
    aiProfileCounts: {},
    lastUpdatedAt: now,
  });
  const doc = await ctx.db.get(id);
  if (!doc) {
    throw new Error("Failed to create user_stats");
  }
  return doc;
}

export const incrementThreads = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await getOrCreate(ctx, args.userId);

    const stats = {
      ...doc.stats,
      threads: doc.stats.threads + 1,
    };

    await ctx.db.patch(doc._id, {
      stats,
      lastUpdatedAt: Date.now(),
    });

    return null;
  },
});

export const incrementOnUserMessage = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.id("threads"),
    content: v.string(),
    createdAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await getOrCreate(ctx, args.userId);

    const words = wordCount(args.content);
    const day = dayKey(args.createdAt);

    const stats = {
      ...doc.stats,
      words: doc.stats.words + words,
      messages: {
        ...doc.stats.messages,
        user: doc.stats.messages.user + 1,
      },
    };

    const threadCounts: Record<Id<"threads">, number> = { ...doc.threadCounts };
    threadCounts[args.threadId] = (threadCounts[args.threadId] ?? 0) + 1;

    const activityCounts: Record<string, number> = { ...doc.activityCounts };
    activityCounts[day] = (activityCounts[day] ?? 0) + 1;

    await ctx.db.patch(doc._id, {
      stats,
      threadCounts,
      activityCounts,
      lastUpdatedAt: Date.now(),
    });

    return null;
  },
});

export const incrementOnAssistantComplete = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.id("threads"),
    content: v.string(),
    modelUniqueId: v.string(),
    createdAt: v.number(),
    aiProfileId: v.optional(v.id("ai_profiles")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await getOrCreate(ctx, args.userId);

    const words = wordCount(args.content);
    const day = dayKey(args.createdAt);

    const stats = {
      ...doc.stats,
      words: doc.stats.words + words,
      messages: {
        ...doc.stats.messages,
        assistant: doc.stats.messages.assistant + 1,
      },
    };

    const threadCounts: Record<Id<"threads">, number> = { ...doc.threadCounts };
    threadCounts[args.threadId] = (threadCounts[args.threadId] ?? 0) + 1;

    const activityCounts: Record<string, number> = { ...doc.activityCounts };
    activityCounts[day] = (activityCounts[day] ?? 0) + 1;

    const modelCounts: Record<string, number> = { ...doc.modelCounts };
    const normalizedModelId = getModelData(args.modelUniqueId).id;
    modelCounts[normalizedModelId] = (modelCounts[normalizedModelId] ?? 0) + 1;

    const aiProfileCounts: Record<string, number> = { ...doc.aiProfileCounts };
    const aiKey = args.aiProfileId ?? "null";
    aiProfileCounts[aiKey] = (aiProfileCounts[aiKey] ?? 0) + 1;

    await ctx.db.patch(doc._id, {
      stats,
      threadCounts,
      activityCounts,
      modelCounts,
      aiProfileCounts,
      lastUpdatedAt: Date.now(),
    });

    return null;
  },
});
