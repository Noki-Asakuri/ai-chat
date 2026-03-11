import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { authenticatedMutation, authenticatedQuery } from "../components";

/**
 * List all groups for the current user ordered by `order` asc.
 */
export const listGroups = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const groupsPromise = ctx.db
      .query("groups")
      .withIndex("by_userId_order", (q) => q.eq("userId", user.userId))
      .order("asc")
      .collect();

    const threadsPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) => q.eq("userId", user.userId))
      .order("asc")
      .collect();

    const [groups, threads] = await Promise.all([groupsPromise, threadsPromise]);

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
export const createGroup = authenticatedMutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const last = await ctx.db
      .query("groups")
      .withIndex("by_userId_order", (q) => q.eq("userId", user.userId))
      .order("desc")
      .take(1);

    const nextOrder = (last[0]?.order ?? 0) + 1;

    const id = await ctx.db.insert("groups", {
      title: args.title,
      order: nextOrder,
      userId: user.userId,
    });

    return id;
  },
});

/**
 * Delete a group.
 * All threads in this group are moved to the "Ungrouped" (groupId = null) container.
 */
export const deleteGroup = authenticatedMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.userId !== user.userId) throw new Error("Not authorized");

    // Move threads from this group to ungrouped with increasing order
    const threadsInGroup = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.userId).eq("groupId", args.groupId),
      )
      .order("asc")
      .collect();

    for (const t of threadsInGroup) {
      await ctx.db.patch(t._id, { groupId: null, order: 0 });
    }

    // Delete the group
    await ctx.db.delete(args.groupId);
    return null;
  },
});

/**
 * Update a group's title.
 */
export const updateGroupTitle = authenticatedMutation({
  args: { groupId: v.id("groups"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch(args.groupId, { title: args.title.trim() });
    return null;
  },
});

/**
 * Re-order thread within same group
 */
export const reorderThreadWithinGroup = authenticatedMutation({
  args: { threadId: v.id("threads"), toIndex: v.number() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const threadsInGroup = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.userId).eq("groupId", thread.groupId),
      )
      .order("asc")
      .collect();

    // Remove the thread from the list
    const threads = threadsInGroup.filter((t) => t._id !== args.threadId);
    // Clamp target index to [0, threads.length] so dropping at the end appends
    const insertIndex = Math.max(0, Math.min(args.toIndex, threads.length));
    // Insert at the new index
    threads.splice(insertIndex, 0, thread);

    // Reorder all threads in the group to fill the gap
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      if (!thread) continue;
      await ctx.db.patch(thread._id, { order: i });
    }
  },
});

export const removeGroupId = authenticatedMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    if (thread.groupId === null) return;

    await ctx.db.patch(args.threadId, { groupId: null, order: 0 });

    const threadsInOldGroup = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.userId).eq("groupId", thread.groupId),
      )
      .order("asc")
      .collect();

    // Remove thread in old group
    threadsInOldGroup.splice(thread.order!, 1);
    // Reorder all threads in the old group to fill the gap
    for (let i = 0; i < threadsInOldGroup.length; i++) {
      const thread = threadsInOldGroup[i];
      if (!thread) continue;
      await ctx.db.patch(thread._id, { order: i });
    }
  },
});

export const moveThreadToGroup = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    toGroupId: v.nullable(v.id("groups")),
    toIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const oldIndex = thread.order!;
    const oldGroupId = thread.groupId;

    const threadsInOldGroupPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.userId).eq("groupId", oldGroupId),
      )
      .order("asc")
      .collect();

    const threadsInNewGroupPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.userId).eq("groupId", args.toGroupId),
      )
      .order("asc")
      .collect();

    const [threadsInOldGroup, threadsInNewGroup] = await Promise.all([
      threadsInOldGroupPromise,
      threadsInNewGroupPromise,
    ]);

    // Insert the new thread in new group
    const insertIndex =
      args.toGroupId === null ? 0 : Math.max(0, Math.min(args.toIndex, threadsInNewGroup.length));

    threadsInNewGroup.splice(insertIndex, 0, thread);
    await ctx.db.patch(thread._id, { groupId: args.toGroupId, order: insertIndex });

    if (args.toGroupId !== null) {
      // Reorder all threads in the new group to fill the gap
      for (let i = 0; i < threadsInNewGroup.length; i++) {
        const thread = threadsInNewGroup[i];
        if (!thread) continue;
        await ctx.db.patch(thread._id, { order: i });
      }
    }

    if (oldGroupId !== null) {
      // Remove thread in old group
      threadsInOldGroup.splice(oldIndex, 1);
      // Reorder all threads in the old group to fill the gap
      for (let i = 0; i < threadsInOldGroup.length; i++) {
        const thread = threadsInOldGroup[i];
        if (!thread) continue;
        await ctx.db.patch(thread._id, { order: i });
      }
    }
  },
});

export const moveGroupToIndex = authenticatedMutation({
  args: { groupId: v.id("groups"), toIndex: v.number() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.userId !== user.userId) throw new Error("Not authorized");

    const groups = await ctx.db
      .query("groups")
      .withIndex("by_userId_order", (q) => q.eq("userId", user.userId))
      .order("asc")
      .collect();

    // Remove the group from the list
    const filtered = groups.filter((g) => g._id !== args.groupId);
    // Clamp target index to [0, groups.length] so dropping at the end appends
    const insertIndex = Math.max(0, Math.min(args.toIndex, filtered.length));
    // Insert at the new index
    filtered.splice(insertIndex, 0, group);

    // Reorder all groups to fill the gap
    for (let i = 0; i < filtered.length; i++) {
      const group = filtered[i];
      if (!group) continue;
      await ctx.db.patch(group._id, { order: i });
    }
  },
});
