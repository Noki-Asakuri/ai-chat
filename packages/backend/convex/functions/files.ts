import { type R2Callbacks } from "@convex-dev/r2";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { authenticatedMutation, r2 } from "../components";

const callbacks: R2Callbacks = internal.functions.files;

export { getMetadata, listMetadata, onSyncMetadata, syncMetadata };

export const validExtensions = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const { syncMetadata, getMetadata, listMetadata, onSyncMetadata } = r2.clientApi<DataModel>({
  callbacks,
});

export const generateAttachmentUploadUrl = authenticatedMutation({
  args: { threadId: v.id("threads"), fileId: v.string(), mimeType: v.string() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get("threads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    if (!validExtensions.includes(args.mimeType)) {
      throw new Error("Invalid file type");
    }

    const ext = args.mimeType.split("/")[1];
    const key = `${user.userId}/${thread._id}/${args.fileId}.${ext}`;

    return r2.generateUploadUrl(key);
  },
});

export const generateUserUploadUrl = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const key = `${user.userId}/customization/${crypto.randomUUID()}`;
    return r2.generateUploadUrl(key);
  },
});

export const generateUserAvatarUploadUrl = authenticatedMutation({
  args: { mimeType: v.string() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const allowedMimeTypes: Array<string> = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(args.mimeType)) {
      throw new Error("Invalid file type");
    }

    const ext = args.mimeType.split("/")[1];
    const key = `${user.userId}/avatar/${crypto.randomUUID()}.${ext}`;

    return r2.generateUploadUrl(key);
  },
});

export const deleteFile = authenticatedMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    if (!args.key.startsWith(`${user.userId}/`)) {
      throw new Error("Not authorized");
    }

    await r2.deleteObject(ctx, args.key);
  },
});
