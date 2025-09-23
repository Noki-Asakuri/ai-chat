import { v } from "convex/values";

import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * List all groups for the current user ordered by `order` asc.
 */
export const listGroups = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const groups = await ctx.db
      .query("groups")
      .withIndex("by_userId_order", (q) => q.eq("userId", user.subject))
      .order("asc")
      .collect();

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) => q.eq("userId", user.subject))
      .order("asc")
      .collect();

    const groupedThreads = threads.reduce(
      (acc, thread) => {
        const groupId = thread.groupId ?? "none";

        acc[groupId] ??= { group: null, threads: [] };
        acc[groupId].threads.push(thread);

        return acc;
      },
      {} as Record<
        Id<"groups"> | "none",
        { group: Doc<"groups"> | null; threads: Doc<"threads">[] }
      >,
    );

    for (const group of groups) {
      const existing = groupedThreads[group._id] ?? { group: null, threads: [] };
      groupedThreads[group._id] = { ...existing, group };
    }

    return { groupedThreads, groups, threads, length: threads.length };
  },
});

/**
 * Create a group with the next available order for the current user.
 */
export const createGroup = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const last = await ctx.db
      .query("groups")
      .withIndex("by_userId_order", (q) => q.eq("userId", user.subject))
      .order("desc")
      .take(1);

    const nextOrder = (last[0]?.order ?? 0) + 1;

    const id = await ctx.db.insert("groups", {
      title: args.title,
      order: nextOrder,
      userId: user.subject,
    });

    return id;
  },
});

/**
 * Delete a group.
 * All threads in this group are moved to the "Ungrouped" (groupId = null) container.
 */
export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.userId !== user.subject) throw new Error("Not authorized");

    // Determine current max order among ungrouped threads
    const lastUngrouped = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) => q.eq("userId", user.subject).eq("groupId", null))
      .order("desc")
      .take(1);
    let nextOrder = (lastUngrouped[0]?.order ?? 0) + 1;

    // Move threads from this group to ungrouped with increasing order
    const threadsInGroup = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.subject).eq("groupId", args.groupId),
      )
      .order("asc")
      .collect();

    for (const t of threadsInGroup) {
      await ctx.db.patch(t._id, { groupId: null, order: nextOrder++ });
    }

    // Delete the group
    await ctx.db.delete(args.groupId);
    return null;
  },
});

/**
 * Reorder groups for the current user using the provided ordered list of ids.
 * This sets `order = index + 1` for each id.
 */
export const reorderGroups = mutation({
  args: { orderedIds: v.array(v.id("groups")) },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    for (let i = 0; i < args.orderedIds.length; i++) {
      const id = args.orderedIds[i] as Id<"groups">;
      const g = await ctx.db.get(id);
      if (!g) continue;
      if (g.userId !== user.subject) throw new Error("Not authorized");
      await ctx.db.patch(id, { order: i + 1 });
    }
    return null;
  },
});

/**
 * Move a thread to a different group or reposition within the same group.
 * If destination.beforeId is provided, the thread will be placed directly before that thread.
 * Otherwise the thread will be appended to the end of the destination group.
 */
export const moveThread = mutation({
  args: {
    threadId: v.id("threads"),
    destination: v.object({
      groupId: v.union(v.id("groups"), v.null()),
      beforeId: v.optional(v.id("threads")),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const t = await ctx.db.get(args.threadId);
    if (!t) throw new Error("Thread not found");
    if (t.userId !== user.subject) throw new Error("Not authorized");

    let targetGroupId: Id<"groups"> | null = args.destination.groupId;
    const beforeId = args.destination.beforeId ?? null;

    if (beforeId) {
      const before = await ctx.db.get(beforeId);
      if (!before) throw new Error("Thread not found");
      if (before.userId !== user.subject) throw new Error("Not authorized");
      // Ensure consistency: beforeId's group determines destination group when provided
      targetGroupId = (before.groupId ?? null) as Id<"groups"> | null;
    }

    let newOrder: number;

    if (beforeId) {
      const before = (await ctx.db.get(beforeId))!;
      const beforeOrder = before.order ?? 0;

      const prev = await ctx.db
        .query("threads")
        .withIndex("by_userId_groupId_order", (q) =>
          q.eq("userId", user.subject).eq("groupId", targetGroupId).lt("order", beforeOrder),
        )
        .order("desc")
        .take(1);

      const prevOrder = prev[0]?.order ?? null;
      newOrder = prevOrder === null ? beforeOrder - 1 : (prevOrder + beforeOrder) / 2;
    } else {
      const last = await ctx.db
        .query("threads")
        .withIndex("by_userId_groupId_order", (q) =>
          q.eq("userId", user.subject).eq("groupId", targetGroupId),
        )
        .order("desc")
        .take(1);

      newOrder = (last[0]?.order ?? 0) + 1;
    }

    await ctx.db.patch(args.threadId, { groupId: targetGroupId, order: newOrder });
    return null;
  },
});
