import { v } from "convex/values";

import { r2 } from "..";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const createAttachment = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    size: v.number(),
    threadId: v.id("threads"),
    type: v.union(v.literal("image"), v.literal("pdf")),
    source: v.union(v.literal("assistant"), v.literal("user")),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("attachments", { ...args, userId: user.subject });
  },
});

export const getAllAttachments = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_userId", (q) => q.eq("userId", user.subject))
      .order("desc")
      .collect();

    return await Promise.all(
      attachments.map(async (attachment) => {
        const thread = await ctx.db.get(attachment.threadId);
        return { ...attachment, thread };
      }),
    );
  },
});

export const deleteAttachment = mutation({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) throw new Error("Attachment not found");
    if (attachment.userId !== user.subject) throw new Error("Not authorized");

    // Unlink this attachment from any messages in the same thread for this user
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.subject).eq("threadId", attachment.threadId),
      )
      .collect();

    for (const message of messages) {
      const current = message.attachments ?? [];
      if (current.length === 0) continue;

      const filtered = current.filter((id) => id !== args.attachmentId);
      if (filtered.length !== current.length) {
        // If nothing left, keep as empty array to be explicit
        await ctx.db.patch(message._id, { attachments: filtered });
      }
    }

    // Delete file from R2 and remove the attachment document
    const key = `${attachment.userId}/${attachment.threadId}/${attachment._id}`;
    await r2.deleteObject(ctx, key);
    await ctx.db.delete(args.attachmentId);
  },
});

/**
 * Bulk delete multiple attachments in one request.
 * - Verifies ownership for all provided ids.
 * - Unlinks all provided attachments from any of the user's messages in the corresponding threads.
 * - Deletes files from R2 and removes attachment documents.
 */
export const deleteAttachments = mutation({
  args: { attachmentIds: v.array(v.id("attachments")) },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");
    if (args.attachmentIds.length === 0) return;

    // Load and validate all attachments
    const attachments = await Promise.all(args.attachmentIds.map((id) => ctx.db.get(id)));
    const notFound = attachments.findIndex((a) => a === null);
    if (notFound !== -1) throw new Error("Attachment not found");
    const owned = attachments as NonNullable<(typeof attachments)[number]>[];
    for (const a of owned) {
      if (a.userId !== user.subject) throw new Error("Not authorized");
    }

    // Group by threadId to minimize message scans
    const byThread = new Map<Id<"threads">, Set<Id<"attachments">>>();
    for (const a of owned) {
      const key = a.threadId;
      const set = byThread.get(key) ?? new Set<Id<"attachments">>();

      set.add(a._id);
      byThread.set(key, set);
    }

    // For each affected thread, unlink all targeted attachments from the user's messages
    for (const [threadId, ids] of byThread) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_userId_threadId", (q) =>
          q.eq("userId", user.subject).eq("threadId", threadId),
        )
        .collect();

      for (const message of messages) {
        const current = message.attachments ?? [];
        if (current.length === 0) continue;
        const filtered = current.filter((id) => !ids.has(id));
        if (filtered.length !== current.length) {
          await ctx.db.patch(message._id, { attachments: filtered });
        }
      }
    }

    // Delete files from R2 and remove attachment documents
    await Promise.all(
      owned.map(async (a) => {
        const key = `${a.userId}/${a.threadId}/${a._id}`;
        await r2.deleteObject(ctx, key);
        await ctx.db.delete(a._id);
      }),
    );
  },
});
