import { R2, type R2Callbacks } from "@convex-dev/r2";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

export const r2 = new R2(components.r2);
const callbacks: R2Callbacks = internal.files;

export const { syncMetadata, getMetadata, listMetadata, deleteObject, onSyncMetadata } =
  r2.clientApi<DataModel>({
    callbacks,
    async checkUpload(ctx, bucket) {
      const user = await ctx.auth.getUserIdentity();
      if (!user) throw new Error("Not authenticated");
    },
  });

export const generateUploadUrl = mutation({
  args: { threadId: v.id("threads"), fileId: v.string() },
  handler: async (ctx, args) => {
    const currentUser = await ctx.auth.getUserIdentity();
    if (!currentUser) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== currentUser.subject) throw new Error("Not authorized");

    const key = `${currentUser.subject}/${thread._id}/${args.fileId}`;
    return r2.generateUploadUrl(key);
  },
});
