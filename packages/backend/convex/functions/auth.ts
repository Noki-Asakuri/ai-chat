import type { Doc } from "../_generated/dataModel";
import { authKit } from "../components";

import { DEFAULT_BASE } from "./usages";
import { DEFAULT_USER_PREFERENCES } from "./users";

function isCustomAvatarUrl(imageUrl: string | null, userId: string): boolean {
  if (!imageUrl) return false;
  return imageUrl.includes(`/${userId}/avatar/`);
}

export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    const firstName = event.data.firstName ?? "user";
    const lastName = event.data.lastName ?? "";

    await ctx.db.insert("users", {
      userId: event.data.id,

      createdAt: Date.now(),
      updatedAt: Date.now(),

      emailAddress: event.data.email,
      imageUrl: event.data.profilePictureUrl,
      username: `${firstName} ${lastName}`.trim(),

      preferences: { ...DEFAULT_USER_PREFERENCES, name: firstName },
    });

    await ctx.db.insert("user_stats", {
      userId: event.data.id,
      stats: {
        threads: 0,
        messages: { assistant: 0, user: 0 },
        tokens: { input: 0, output: 0, reasoning: 0, total: 0 },
        tokensByRole: { assistant: 0, user: 0 },

        words: 0,
        wordsByRole: { assistant: 0, user: 0 },
      },
      modelCounts: {},
      threadCounts: {},
      activityCounts: {},
      aiProfileCounts: {},
      lastUpdatedAt: Date.now(),
    });

    await ctx.db.insert("usages", {
      userId: event.data.id,
      used: 0,
      base: DEFAULT_BASE,
      resetType: "daily",
    });
  },
  "user.updated": async (ctx, event) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", event.data.id))
      .unique();

    if (!user) {
      console.warn(`User not found: ${event.data.id}`);
      return;
    }

    const firstName = event.data.firstName ?? "user";
    const lastName = event.data.lastName ?? "";

    const updates: Partial<Doc<"users">> = {
      emailAddress: event.data.email,
      username: `${firstName} ${lastName}`.trim(),
      updatedAt: Date.now(),
    };

    if (!isCustomAvatarUrl(user.imageUrl, user.userId)) {
      updates.imageUrl = event.data.profilePictureUrl;
    }

    await ctx.db.patch(user._id, updates);
  },
  "user.deleted": async (ctx, event) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", event.data.id))
      .unique();

    if (!user) {
      console.warn(`User not found: ${event.data.id}`);
      return;
    }

    await ctx.db.delete(user._id);
  },

  // Handle any event type
  "session.created": async (ctx, event) => {
    const { userId, id } = event.data;

    await ctx.db.insert("session", {
      userId,
      sessionId: id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  "session.revoked": async (ctx, event) => {
    const { id } = event.data;
    const session = await ctx.db
      .query("session")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", id))
      .unique();

    if (!session) {
      console.warn(`Session not found: ${id}`);
      return;
    }

    await ctx.db.delete(session._id);
  },
});
