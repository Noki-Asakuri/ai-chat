import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
