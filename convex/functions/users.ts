import type { UserJSON, WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

import { v, type Validator } from "convex/values";
import { r2 } from "..";
import { internal } from "../_generated/api";
import { httpAction, internalMutation, mutation, query, type QueryCtx } from "../_generated/server";

export const deleteFromClerk = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByClerkUserId(ctx, args.userId);
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
      .query("ai_profiles")
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

async function getUserByClerkUserId(ctx: QueryCtx, userId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export const upsertFromClerk = internalMutation({
  // no runtime validation, Clerk webhook always return valid data
  args: { data: v.any() as Validator<UserJSON> },
  async handler(ctx, { data }) {
    const mainEmailAddress = data.email_addresses?.find(
      (email) => email.id === data.primary_email_address_id,
    );

    const userAttributes = {
      userId: data.id,

      username: data.username,
      emailAddress: mainEmailAddress?.email_address ?? null,
      imageUrl: data.image_url,

      isBanned: data.banned,

      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    const existUserData = await getUserByClerkUserId(ctx, data.id);
    if (existUserData) return await ctx.db.patch(existUserData._id, userAttributes);

    return await ctx.db.insert("users", {
      ...userAttributes,
      customization: {
        name: data.username!,
        systemInstruction: "You are a helpful assistant.",
        traits: [],
        backgroundId: null,
        hiddenModels: [],
        showFullCode: false,
        disableBlur: false,
      },
    });
  },
});

export const clerkWebhook = httpAction(async (ctx, request) => {
  const event = await validateRequest(request);
  if (!event) return new Response("Error occurred", { status: 400 });

  switch (event.type) {
    case "user.created":
    case "user.updated":
      await ctx.runMutation(internal.functions.users.upsertFromClerk, {
        data: event.data,
      });
      break;

    case "user.deleted": {
      const userId = event.data.id!;
      await ctx.runMutation(internal.functions.users.deleteFromClerk, { userId });
      break;
    }
    default:
      console.log("Ignored Clerk webhook event", event.type);
  }

  return new Response(null, { status: 200 });
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SIGNING_SECRET!);

  try {
    return wh.verify(payloadString, svixHeaders) as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export const updateUserCustomization = mutation({
  args: {
    data: v.object({
      name: v.optional(v.string()),
      occupation: v.optional(v.string()),
      traits: v.optional(v.array(v.string())),
      systemInstruction: v.optional(v.string()),
      backgroundId: v.optional(v.union(v.string(), v.null())),
      disableBlur: v.optional(v.boolean()),
      hiddenModels: v.optional(v.array(v.string())),
      showFullCode: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { data }) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const user = await getUserByClerkUserId(ctx, userId.subject);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { customization: { ...user.customization, ...data } });
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return null;

    const user = await getUserByClerkUserId(ctx, userId.subject);
    if (!user) return null;

    // Ensure hiddenModels is always defined for clients
    const hiddenModels = user.customization?.hiddenModels ?? [];
    return { ...user, customization: { ...user.customization, hiddenModels } };
  },
});
