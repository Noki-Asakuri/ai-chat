import { v } from "convex/values";

import { authenticatedMutation, authenticatedUserIdQuery } from "../components";

/** List all groups for the current user in creation order. */
export const listGroups = authenticatedUserIdQuery({
  args: { activeGroupId: v.optional(v.nullable(v.id("groups"))) },
  handler: async (ctx, args) => {
    const activeGroupId = args.activeGroupId ?? null;
    const groupsPromise = ctx.db
      .query("groups")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
      .order("asc")
      .collect();
    const activeGroupPromise = activeGroupId === null ? null : ctx.db.get("groups", activeGroupId);
    const currentThreadsPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_settled_groupId_updatedAt", (q) =>
        q.eq("userId", ctx.userId).eq("settled", false).eq("groupId", activeGroupId),
      )
      .order("desc")
      .collect();
    const legacyThreadsPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_settled_groupId_updatedAt", (q) =>
        q.eq("userId", ctx.userId).eq("settled", undefined).eq("groupId", activeGroupId),
      )
      .order("desc")
      .collect();

    const [groups, activeGroup, currentThreads, legacyThreads] = await Promise.all([
      groupsPromise,
      activeGroupPromise,
      currentThreadsPromise,
      legacyThreadsPromise,
    ]);

    const groupExists = activeGroupId === null || activeGroup?.userId === ctx.userId;

    if (!groupExists) {
      return { activeGroupId, groups, threads: [] };
    }

    return {
      activeGroupId,
      groups,
      threads: [...currentThreads, ...legacyThreads].sort(
        (left, right) => right.updatedAt - left.updatedAt,
      ),
    };
  },
});

export const createGroup = authenticatedMutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const id = await ctx.db.insert("groups", {
      title: args.title,
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

    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.userId !== user.userId) throw new Error("Not authorized");

    // Move threads from this group to ungrouped.
    const threadsInGroup = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_pinned_settled_updatedAt", (q) =>
        q.eq("userId", user.userId).eq("groupId", args.groupId),
      )
      .collect();

    for (const t of threadsInGroup) {
      await ctx.db.patch(t._id, { groupId: null });
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

    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.userId !== user.userId) throw new Error("Not authorized");

    await ctx.db.patch(args.groupId, { title: args.title.trim() });
    return null;
  },
});

export const moveThreadToGroup = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    toGroupId: v.nullable(v.id("groups")),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    if (args.toGroupId !== null) {
      const group = await ctx.db.get("groups", args.toGroupId);
      if (!group) throw new Error("Group not found");
      if (group.userId !== user.userId) throw new Error("Not authorized");
    }

    await ctx.db.patch(thread._id, { groupId: args.toGroupId });
  },
});
