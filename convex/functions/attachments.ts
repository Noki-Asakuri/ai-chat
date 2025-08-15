import { v } from "convex/values";

import { r2 } from "..";
import { mutation, query } from "../_generated/server";

export const createAttachment = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    size: v.number(),
    type: v.union(v.literal("image"), v.literal("pdf")),
    threadId: v.id("threads"),
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
