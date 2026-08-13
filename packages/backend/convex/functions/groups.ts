import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { authenticatedMutation, authenticatedUserIdQuery } from "../components";

/** List all groups for the current user in creation order. */
export const listGroups = authenticatedUserIdQuery({
  args: {
    activeGroupId: v.optional(v.nullable(v.id("groups"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 40, 1), 200);
    const activeGroupId = args.activeGroupId ?? null;
    const groupsPromise = ctx.db
      .query("groups")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
      .order("asc")
      .take(100);

    const pinnedThreadsPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_pinned_settled_updatedAt", (q) =>
        q
          .eq("userId", ctx.userId)
          .eq("groupId", activeGroupId)
          .eq("pinned", true)
          .eq("settled", false),
      )
      .order("desc")
      .take(100);

    const legacyPinnedThreadsPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_pinned_settled_updatedAt", (q) =>
        q
          .eq("userId", ctx.userId)
          .eq("groupId", activeGroupId)
          .eq("pinned", true)
          .eq("settled", undefined),
      )
      .order("desc")
      .take(100);

    const activeThreadsPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_pinned_settled_updatedAt", (q) =>
        q
          .eq("userId", ctx.userId)
          .eq("groupId", activeGroupId)
          .eq("pinned", false)
          .eq("settled", false),
      )
      .order("desc")
      .take(limit + 1);

    const legacyActiveThreadsPromise = ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_pinned_settled_updatedAt", (q) =>
        q
          .eq("userId", ctx.userId)
          .eq("groupId", activeGroupId)
          .eq("pinned", false)
          .eq("settled", undefined),
      )
      .order("desc")
      .take(limit + 1);

    const [groups, pinnedThreads, legacyPinnedThreads, activeThreads, legacyActiveThreads] =
      await Promise.all([
      groupsPromise,
      pinnedThreadsPromise,
      legacyPinnedThreadsPromise,
      activeThreadsPromise,
      legacyActiveThreadsPromise,
    ]);

    const activeThreadRows = [...activeThreads, ...legacyActiveThreads].sort(
      (left, right) => right.updatedAt - left.updatedAt,
    );

    const groupExists =
      activeGroupId === null ||
      groups.some((group) => group._id === activeGroupId && group.userId === ctx.userId);

    if (!groupExists) {
      return { activeGroupId, groups, threads: [], hasMore: false };
    }

    const threadsById: Record<Id<"threads">, Doc<"threads">> = {};
    for (const thread of [...pinnedThreads, ...legacyPinnedThreads]) {
      if (thread.groupId === activeGroupId && thread.settled !== true) {
        threadsById[thread._id] = thread;
      }
    }

    for (const thread of activeThreadRows.slice(0, limit)) {
      threadsById[thread._id] = thread;
    }

    return {
      activeGroupId,
      groups,
      threads: Object.values(threadsById),
      hasMore: activeThreadRows.length > limit,
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
