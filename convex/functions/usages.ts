import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { authenticatedMutation, authenticatedQuery } from "../components";

// Default daily limit for new users
const DEFAULT_BASE = 25;

/**
 * Public query to retrieve current usage inf for user.
 */
export const getUserUsages = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    if (!user) return null;

    return await ctx.db
      .query("usages")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique();
  },
});

/**
 * Public mutation to check and increment usage by a given amount (default 1).
 * Ensures monthly reset semantics.
 */
export const checkAndIncrement = authenticatedMutation({
  args: { amount: v.number() },
  returns: v.object({
    allowed: v.boolean(),
    used: v.number(),
    base: v.number(),
    resetType: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const usage = await ctx.db
      .query("usages")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique();

    if (!usage) return { allowed: true, used: args.amount, base: DEFAULT_BASE, resetType: "daily" };

    if (usage.used + args.amount > usage.base) {
      return {
        allowed: false,
        used: usage.used,
        base: usage.base,
        resetType: usage.resetType ?? "daily",
      };
    }

    await ctx.db.patch(usage._id, { used: usage.used + args.amount });
    return {
      allowed: true,
      used: usage.used + args.amount,
      base: usage.base,
      resetType: usage.resetType ?? "daily",
    };
  },
});

export const refundRequest = authenticatedMutation({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const usage = await ctx.db
      .query("usages")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique();

    if (!usage) return;
    await ctx.db.patch(usage._id, { used: usage.used - args.amount });
  },
});

/**
 * Internal mutation to reset all usage documents at the start of a new month.
 * Intended for invocation via a cron job.
 */
export const resetAllUsages = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const allUsages = await ctx.db.query("usages").collect();
    for (const usage of allUsages) await ctx.db.patch(usage._id, { used: 0 });
  },
});

/**
 * Internal mutation to reset all usage documents at the start of a new day.
 * Intended for invocation via a cron job.
 */
export const resetAllUsagesDaily = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const allUsages = await ctx.db.query("usages").collect();
    const dailyUsages = allUsages.filter((usage) => usage.resetType === "daily");
    for (const usage of dailyUsages) await ctx.db.patch(usage._id, { used: 0 });
  },
});
