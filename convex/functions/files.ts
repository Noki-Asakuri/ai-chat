import { type R2Callbacks } from "@convex-dev/r2";
import { v } from "convex/values";

import { r2 } from "..";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { mutation } from "../_generated/server";

const callbacks: R2Callbacks = internal.functions.files;

export { syncMetadata, getMetadata, listMetadata, onSyncMetadata };

const { syncMetadata, getMetadata, listMetadata, onSyncMetadata } = r2.clientApi<DataModel>({
  callbacks,
  async checkUpload(ctx) {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");
  },
});

export const generateAttachmentUploadUrl = mutation({
  args: { threadId: v.id("threads"), fileId: v.id("attachments") },
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

export const generateUserUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await ctx.auth.getUserIdentity();
    if (!currentUser) throw new Error("Not authenticated");

    const key = `${currentUser.subject}/customization/${crypto.randomUUID()}`;
    return r2.generateUploadUrl(key);
  },
});

export const deleteFile = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const currentUser = await ctx.auth.getUserIdentity();
    if (!currentUser) throw new Error("Not authenticated");

    if (!args.key.startsWith(`${currentUser.subject}/`)) {
      throw new Error("Not authorized");
    }

    await r2.deleteObject(ctx, args.key);
  },
});
