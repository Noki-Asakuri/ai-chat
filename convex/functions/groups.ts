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
      groupedThreads[group._id] = { ...groupedThreads[group._id], group };
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
