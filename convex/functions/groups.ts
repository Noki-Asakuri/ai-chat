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
 * Reorder a thread to a target group and index, and renumber orders sequentially.
 */
export const reorderThread = mutation({
  args: {
    threadId: v.id("threads"),
    toGroupId: v.union(v.id("groups"), v.null()),
    index: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.subject) throw new Error("Not authorized");

    const sourceGroupId = thread.groupId ?? null;
    const destGroupId = args.toGroupId ?? null;

    // Fetch destination threads (excluding the moving one if same group)
    const destThreadsAll = await ctx.db
      .query("threads")
      .withIndex("by_userId_groupId_order", (q) =>
        q.eq("userId", user.subject).eq("groupId", destGroupId),
      )
      .order("asc")
      .collect();

    const destThreads = destThreadsAll.filter((t) => t._id !== args.threadId);

    // Compute clamped insertion index
    const insertIndex = Math.max(0, Math.min(args.index, destThreads.length));

    // Insert the moving thread into destination array at the desired position
    const moving: Doc<"threads"> = { ...thread, groupId: destGroupId };
    destThreads.splice(insertIndex, 0, moving);

    // Reassign sequential order in destination group
    for (let i = 0; i < destThreads.length; i++) {
      const t = destThreads[i]!;
      const desiredOrder = i + 1;
      const desiredGroupId = destGroupId;
      if (t._id === thread._id) {
        if (t.groupId !== desiredGroupId || t.order !== desiredOrder) {
          await ctx.db.patch(t._id, { groupId: desiredGroupId, order: desiredOrder });
        }
      } else if (t.order !== desiredOrder) {
        await ctx.db.patch(t._id, { order: desiredOrder });
      }
    }

    // If moved across groups, renumber the source group as well
    if (destGroupId !== sourceGroupId) {
      const sourceThreads = await ctx.db
        .query("threads")
        .withIndex("by_userId_groupId_order", (q) =>
          q.eq("userId", user.subject).eq("groupId", sourceGroupId),
        )
        .order("asc")
        .collect();

      // The moving thread is already removed; just resequence
      for (let i = 0; i < sourceThreads.length; i++) {
        const t = sourceThreads[i]!;
        const desiredOrder = i + 1;
        if (t.order !== desiredOrder) {
          await ctx.db.patch(t._id, { order: desiredOrder });
        }
      }
    }

    return { ok: true as const };
  },
});
