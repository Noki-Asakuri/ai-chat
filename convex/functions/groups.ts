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
 * Re-order thread within same group
 */
export const reorderThreadWithinGroup = mutation({
  args: { threadId: v.id("threads"), toIndex: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    const threadsInGroup = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.subject).eq("groupId", thread.groupId),
      )
      .order("asc")
      .collect();

    // Remove the thread from the list
    const threads = threadsInGroup.filter((t) => t._id !== args.threadId);
    // Insert at the new index
    threads.splice(args.toIndex, 0, thread);

    // Reorder all threads in the group to fill the gap
    for (let i = 0; i < threads.length; i++) {
      await ctx.db.patch(threads[i]._id, { order: i });
    }
  },
});

export const moveThreadToGroup = mutation({
  args: {
    threadId: v.id("threads"),
    toGroupId: v.union(v.id("groups"), v.null()),
    toIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    const oldIndex = thread.order!;
    const oldGroupId = thread.groupId;

    const threadsInOldGroup = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.subject).eq("groupId", oldGroupId),
      )
      .order("asc")
      .collect();

    const threadsInNewGroup = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.subject).eq("groupId", args.toGroupId),
      )
      .order("asc")
      .collect();

    // Insert the new thread in new group
    threadsInNewGroup.splice(args.toIndex, 0, thread);
    await ctx.db.patch(thread._id, { groupId: args.toGroupId, order: args.toIndex });

    // Reorder all threads in the new group to fill the gap
    for (let i = 0; i < threadsInNewGroup.length; i++) {
      await ctx.db.patch(threadsInNewGroup[i]._id, { order: i });
    }

    // Remove thread in old group
    threadsInOldGroup.splice(oldIndex, 1);
    // Reorder all threads in the old group to fill the gap
    for (let i = 0; i < threadsInOldGroup.length; i++) {
      await ctx.db.patch(threadsInOldGroup[i]._id, { order: i });
    }
  },
});
