import { v } from "convex/values";

import { r2 } from ".";
import { mutation, query } from "./_generated/server";

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

    await r2
      .deleteObject(ctx, `${attachment.userId}/${attachment.threadId}/${args.attachmentId}`)
      .then(() => ctx.db.delete(args.attachmentId));
  },
});
