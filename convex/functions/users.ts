import { v } from "convex/values";
import { r2 } from "..";
import { internalMutation, mutation, query, type QueryCtx } from "../_generated/server";

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

// export const upsertFromClerk = internalMutation({
//   // no runtime validation, Clerk webhook always return valid data
//   args: {
//     data: v.any() as Validator<UserJSON>,
//     event: v.union(v.literal("created"), v.literal("updated")),
//   },
//   async handler(ctx, { data, event }) {
//     const mainEmailAddress = data.email_addresses?.find(
//       (email) => email.id === data.primary_email_address_id,
//     );

//     const userAttributes = {
//       userId: data.id,

//       username: data.username,
//       emailAddress: mainEmailAddress?.email_address ?? null,
//       imageUrl: data.image_url,

//       isBanned: data.banned,

//       createdAt: data.created_at,
//       updatedAt: data.updated_at,
//     };

//     switch (event) {
//       case "updated":
//         const existUserData = await getUserByClerkUserId(ctx, data.id);
//         if (existUserData) await ctx.db.patch(existUserData._id, userAttributes);

//       case "created":
//         await ctx.db.insert("usages", { userId: data.id, used: 0, base: 25, resetType: "daily" });

//         return await ctx.db.insert("users", {
//           ...userAttributes,
//           customization: {
//             name: data.username!,
//             systemInstruction: "You are a helpful assistant.",
//             traits: [],
//             backgroundId: null,
//             hiddenModels: [],
//             showFullCode: false,
//             disableBlur: false,
//           },
//         });
//     }
//   },
// });

// export const clerkWebhook = httpAction(async (ctx, request) => {
//   const event = await validateRequest(request);
//   if (!event) return new Response("Error occurred", { status: 400 });

//   switch (event.type) {
//     case "user.created":
//     case "user.updated":
//       await ctx.runMutation(internal.functions.users.upsertFromClerk, {
//         data: event.data,
//         event: event.type === "user.created" ? "created" : "updated",
//       });
//       break;

//     case "user.deleted": {
//       const userId = event.data.id!;
//       await ctx.runMutation(internal.functions.users.deleteFromClerk, { userId });
//       break;
//     }
//     default:
//       console.log("Ignored Clerk webhook event", event.type);
//   }

//   return new Response(null, { status: 200 });
// });

// async function validateRequest(req: Request): Promise<WebhookEvent | null> {
//   const payloadString = await req.text();
//   const svixHeaders = {
//     "svix-id": req.headers.get("svix-id")!,
//     "svix-timestamp": req.headers.get("svix-timestamp")!,
//     "svix-signature": req.headers.get("svix-signature")!,
//   };

//   const wh = new Webhook(process.env.CLERK_WEBHOOK_SIGNING_SECRET!);

//   try {
//     return wh.verify(payloadString, svixHeaders) as WebhookEvent;
//   } catch (error) {
//     console.error("Error verifying webhook event", error);
//     return null;
//   }
// }

export const updateUserCustomization = mutation({
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
        showFullCode: v.boolean(),
      })
      .partial(),
  },
  handler: async (ctx, { data }) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const user = await getUserById(ctx, userId.subject);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { customization: { ...user.customization, ...data } });
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return null;

    const user = await getUserById(ctx, userId.subject);
    if (!user) return null;

    // Ensure hiddenModels is always defined for clients
    const hiddenModels = user.customization?.hiddenModels ?? [];
    return { ...user, customization: { ...user.customization, hiddenModels } };
  },
});

export const migrateUserData = internalMutation({
  args: { oldUserId: v.string(), newUserId: v.string() },
  handler: async (ctx, args) => {
    const oldUser = await getUserById(ctx, args.oldUserId);
    if (!oldUser) return;

    await ctx.db.patch(oldUser._id, { userId: args.newUserId });

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", args.oldUserId))
      .collect();

    for (const thread of threads) {
      await ctx.db.patch(thread._id, { userId: args.newUserId });
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) => q.eq("userId", args.oldUserId))
      .collect();

    for (const message of messages) {
      await ctx.db.patch(message._id, { userId: args.newUserId });
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
