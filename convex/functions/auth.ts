import { authKit } from "../components";
import { DEFAULT_BASE } from "./usages";
import { DEFAULT_USER_PREFERENCES } from "./users";

export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    await ctx.db.insert("users", {
      userId: event.data.id,

      emailAddress: event.data.email,
      imageUrl: event.data.profilePictureUrl,
      username: `${event.data.firstName} ${event.data.lastName}`,

      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        name: event.data.firstName ?? "user",
      },
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

    await ctx.db.patch(user._id, {
      emailAddress: event.data.email,
      imageUrl: event.data.profilePictureUrl,
      username: `${event.data.firstName} ${event.data.lastName}`,
      updatedAt: Date.now(),
    });
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
