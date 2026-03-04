import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalMutation, type QueryCtx } from "../_generated/server";
import { authenticatedMutation, authenticatedQuery, r2 } from "../components";

const MODEL_PROVIDER_PREFIXES = ["google/", "openai/", "deepseek/"] as const;

function isValidModelId(modelId: string) {
  for (const prefix of MODEL_PROVIDER_PREFIXES) {
    if (modelId.startsWith(prefix)) {
      const remainder = modelId.slice(prefix.length);
      return remainder.length > 0;
    }
  }

  return false;
}

function sanitizeModelIds(modelIds: string[]) {
  const next: string[] = [];
  const seen = new Set<string>();

  for (const modelId of modelIds) {
    if (!isValidModelId(modelId)) continue;
    if (seen.has(modelId)) continue;

    seen.add(modelId);
    next.push(modelId);
  }

  return next;
}

export const deleteUserData = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserById(ctx, args.userId);
    if (!user) return;

    const threadPromises = ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    const messagePromises = ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", user.userId))
      .collect();

    const groupsPromises = ctx.db
      .query("groups")
      .withIndex("by_userId_order", (q) => q.eq("userId", user.userId))
      .collect();

    const attachmentsPromises = ctx.db
      .query("attachments")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    const profilesPromises = ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    const usagesPromises = ctx.db
      .query("usages")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    const [threads, messages, groups, attachments, profiles, usages] = await Promise.all([
      threadPromises,
      messagePromises,
      groupsPromises,
      attachmentsPromises,
      profilesPromises,
      usagesPromises,
    ]);

    await ctx.db.delete(user._id);

    for (const thread of threads) {
      await ctx.db.delete(thread._id);
    }

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    for (const group of groups) {
      await ctx.db.delete(group._id);
    }

    for (const attachment of attachments) {
      await Promise.all([ctx.db.delete(attachment._id), r2.deleteObject(ctx, attachment.path)]);
    }

    for (const profile of profiles) {
      await ctx.db.delete(profile._id);
    }

    for (const usage of usages) {
      await ctx.db.delete(usage._id);
    }
  },
});

async function getUserById(ctx: QueryCtx, userId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export const updateUserCustomization = authenticatedMutation({
  args: {
    data: v
      .object({
        name: v.string(),
        occupation: v.string(),
        traits: v.array(v.string()),
        systemInstruction: v.string(),
        backgroundId: v.nullable(v.string()),
        disableBlur: v.boolean(),
        hiddenModels: v.array(v.string()),
        favoriteModels: v.array(v.string()),
        showFullCode: v.boolean(),
      })
      .partial(),
  },
  handler: async (ctx, { data }) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const updates = { ...data };

    if (updates.hiddenModels !== undefined) {
      updates.hiddenModels = sanitizeModelIds(updates.hiddenModels);
    }

    if (updates.favoriteModels !== undefined) {
      updates.favoriteModels = sanitizeModelIds(updates.favoriteModels);
    }

    await ctx.db.patch(user._id, { customization: { ...user.customization, ...updates } });
  },
});

export const currentUser = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    if (!user) return null;

    // Ensure model customization arrays are always defined for clients
    const hiddenModels = sanitizeModelIds(user.customization?.hiddenModels ?? []);
    const favoriteModels = sanitizeModelIds(user.customization?.favoriteModels ?? []);
    return { ...user, customization: { ...user.customization, hiddenModels, favoriteModels } };
  },
});

export const migrateUserData = internalMutation({
  args: { oldUserId: v.string(), newUserId: v.string() },
  handler: async (ctx, args) => {
    const oldUser = await getUserById(ctx, args.oldUserId);
    const newUser = await getUserById(ctx, args.newUserId);

    if (oldUser) {
      if (!newUser) await ctx.db.patch("users", oldUser._id, { userId: args.newUserId });
      else {
        await ctx.db.delete("users", oldUser._id);
        await ctx.db.patch("users", newUser._id, { customization: oldUser.customization });
      }
    }

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", args.oldUserId))
      .collect();

    for (const thread of threads) {
      await ctx.db.patch(thread._id, { userId: args.newUserId });
    }

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_userId", (q) => q.eq("userId", args.oldUserId))
      .collect();

    for (const attachment of attachments) {
      await ctx.db.patch(attachment._id, { userId: args.newUserId });
    }

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.oldUserId))
      .collect();

    for (const profile of profiles) {
      await ctx.db.patch(profile._id, { userId: args.newUserId });
    }

    const usages = await ctx.db
      .query("usages")
      .withIndex("by_userId", (q) => q.eq("userId", args.oldUserId))
      .collect();

    for (const usage of usages) {
      await ctx.db.patch(usage._id, { userId: args.newUserId });
    }

    const stats = await ctx.db
      .query("user_stats")
      .withIndex("by_userId", (q) => q.eq("userId", args.oldUserId))
      .collect();

    for (const stat of stats) {
      await ctx.db.patch(stat._id, { userId: args.newUserId });
    }

    const groups = await ctx.db
      .query("groups")
      .withIndex("by_userId_order", (q) => q.eq("userId", args.oldUserId))
      .collect();

    for (const group of groups) {
      await ctx.db.patch(group._id, { userId: args.newUserId });
    }
  },
});

export const migrateUserMessages = internalAction({
  args: { oldUserId: v.string(), newUserId: v.string() },
  handler: async (ctx, args) => {
    console.log("Starting migration");
    let cursor: string | null = null;

    while (true) {
      const result: string | null = await ctx.runMutation(
        internal.functions.users.migrateUserMessageWithCursor,
        { ...args, cursor },
      );

      if (!result) break;
      cursor = result;
    }

    console.log("Migration complete");
  },
});

export const migrateUserMessageWithCursor = internalMutation({
  args: { oldUserId: v.string(), newUserId: v.string(), cursor: v.nullable(v.string()) },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", args.oldUserId))
      .paginate({ cursor: args.cursor, numItems: 500 });

    if (messages.page.length === 0) return null;
    const cursor = messages.continueCursor;

    for (const message of messages.page) {
      await ctx.db.patch(message._id, { userId: args.newUserId });
    }

    return cursor;
  },
});
