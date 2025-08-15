import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { type Doc } from "../_generated/dataModel";

const DEFAULT_BASE = 2000;

type Usage = Doc<"usages">;

function monthStartUtcTs(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  return d.getTime();
}

function sanitizeBase(base: number | undefined): number {
  return typeof base === "number" && base > 0 ? base : DEFAULT_BASE;
}

async function getUsageDoc(ctx: QueryCtx, userId: string): Promise<Usage | null> {
  return await ctx.db
    .query("usages")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

async function getOrInitUsageMut(ctx: MutationCtx, userId: string): Promise<Usage> {
  const existing = await ctx.db
    .query("usages")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (existing) {
    // Ensure base is valid
    const base = sanitizeBase(existing.base);

    if (base !== existing.base) {
      await ctx.db.patch(existing._id, { base });
      const updated = await ctx.db.get(existing._id);
      return updated ?? { ...existing, base };
    }

    return existing;
  }

  const initDoc = {
    userId,
    used: 0,
    base: DEFAULT_BASE,
    resetAt: monthStartUtcTs(),
  };
  const id = await ctx.db.insert("usages", initDoc);
  const inserted = await ctx.db.get(id);
  if (!inserted) {
    // Fallback; should not happen
    throw new Error("Failed to create usage document");
  }
  return inserted;
}

function normalizedFieldsForRead(doc: Usage) {
  const currentStart = monthStartUtcTs();
  const base = sanitizeBase(doc.base);

  if (doc.resetAt < currentStart) {
    return { used: 0, base, resetAt: currentStart };
  }
  return { used: doc.used, base, resetAt: doc.resetAt };
}

async function maybeResetForMutation(ctx: MutationCtx, doc: Usage): Promise<Usage> {
  const currentStart = monthStartUtcTs();
  const base = sanitizeBase(doc.base);

  if (doc.resetAt < currentStart || base !== doc.base) {
    await ctx.db.patch(doc._id, {
      base,
      ...(doc.resetAt < currentStart ? { used: 0, resetAt: currentStart } : {}),
    });
    const updated = await ctx.db.get(doc._id);
    if (updated) return updated;

    return {
      ...doc,
      base,
      ...(doc.resetAt < currentStart ? { used: 0, resetAt: currentStart } : {}),
    };
  }
  return doc;
}

/**
 * Public query to retrieve current usage info.
 * - Read-only, no writes here (per Convex query guidelines).
 */
export const getUsage = query({
  args: {},
  returns: v.object({
    used: v.number(),
    base: v.number(),
    resetAt: v.number(),
    limited: v.boolean(),
  }),
  handler: async (ctx) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) {
      return { used: 0, base: DEFAULT_BASE, resetAt: monthStartUtcTs(), limited: false };
    }

    const doc = await getUsageDoc(ctx, auth.subject);
    if (!doc) {
      const resetAt = monthStartUtcTs();
      return { used: 0, base: DEFAULT_BASE, resetAt, limited: false };
    }

    const normalized = normalizedFieldsForRead(doc);
    return { ...normalized, limited: normalized.used >= normalized.base };
  },
});

/**
 * Public mutation to check and increment usage by a given amount (default 1).
 * Ensures monthly reset semantics.
 */
export const checkAndIncrement = mutation({
  args: { amount: v.optional(v.number()) },
  returns: v.object({
    allowed: v.boolean(),
    used: v.number(),
    base: v.number(),
    resetAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) throw new Error("Not authenticated");

    const amount = typeof args.amount === "number" && args.amount > 0 ? args.amount : 1;

    let usage = await getOrInitUsageMut(ctx, auth.subject);
    usage = await maybeResetForMutation(ctx, usage);

    const base = sanitizeBase(usage.base);
    if (usage.used + amount > base) {
      return { allowed: false, used: usage.used, base, resetAt: usage.resetAt };
    }

    const newUsed = usage.used + amount;
    await ctx.db.patch(usage._id, { used: newUsed });
    return { allowed: true, used: newUsed, base, resetAt: usage.resetAt };
  },
});

export const refundRequest = mutation({
  args: { amount: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) throw new Error("Not authenticated");

    const usage = await getOrInitUsageMut(ctx, auth.subject);

    const newUsed = usage.used - args.amount;
    await ctx.db.patch(usage._id, { used: newUsed });
    return null;
  },
});

/**
 * Internal mutation to reset all usage documents at the start of a new month.
 * Intended for invocation via a cron job.
 */
export const resetAll = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const start = monthStartUtcTs();
    const all = await ctx.db.query("usages").collect();

    for (const doc of all) {
      const base = sanitizeBase(doc.base);
      if (doc.resetAt < start || base !== doc.base) {
        await ctx.db.patch(doc._id, {
          base,
          ...(doc.resetAt < start ? { used: 0, resetAt: start } : {}),
        });
      }
    }

    return null;
  },
});
