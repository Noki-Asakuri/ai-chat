import { v } from "convex/values";
import { r2 } from ".";
import { mutation, query } from "./_generated/server";

/**
 * List AI Profiles for current user with optional search and sorting.
 * Sorting options:
 * - "az": name ascending
 * - "za": name descending
 * - "newest": by createdAt (newest first)
 * - "oldest": by createdAt (oldest first)
 * - "recently-updated": by updatedAt (newest first)
 */
export const listProfiles = query({
  args: {
    search: v.optional(v.string()),
    sort: v.optional(
      v.union(
        v.literal("az"),
        v.literal("za"),
        v.literal("newest"),
        v.literal("oldest"),
        v.literal("recently-updated"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const term = (args.search ?? "").trim();

    // Choose an indexed query when possible for performance
    if (term.length === 0) {
      if (args.sort === "newest") {
        const docs = await ctx.db
          .query("ai_profiles")
          .withIndex("by_userId_createdAt", (q) => q.eq("userId", user.subject))
          .order("desc")
          .collect();
        return docs;
      }

      if (args.sort === "oldest") {
        const docs = await ctx.db
          .query("ai_profiles")
          .withIndex("by_userId_createdAt", (q) => q.eq("userId", user.subject))
          .order("asc")
          .collect();
        return docs;
      }

      if (args.sort === "recently-updated") {
        const docs = await ctx.db
          .query("ai_profiles")
          .withIndex("by_userId_updatedAt", (q) => q.eq("userId", user.subject))
          .order("desc")
          .collect();
        return docs;
      }

      // Default fetch by user, then in-memory sort for name-based sorts
      const docs = await ctx.db
        .query("ai_profiles")
        .withIndex("by_userId", (q) => q.eq("userId", user.subject))
        .collect();

      if (args.sort === "az") {
        return docs.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
      }
      if (args.sort === "za") {
        return docs.sort((a, b) =>
          b.name.localeCompare(a.name, undefined, { sensitivity: "base" }),
        );
      }
      return docs;
    }

    // With search, use search index and then apply sorting in-memory
    const searched = await ctx.db
      .query("ai_profiles")
      .withSearchIndex("search_name", (q) => q.search("name", term).eq("userId", user.subject))
      .collect();

    switch (args.sort) {
      case "az":
        return searched.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
      case "za":
        return searched.sort((a, b) =>
          b.name.localeCompare(a.name, undefined, { sensitivity: "base" }),
        );
      case "newest":
        return searched.sort((a, b) => b.createdAt - a.createdAt);
      case "oldest":
        return searched.sort((a, b) => a.createdAt - b.createdAt);
      case "recently-updated":
        return searched.sort((a, b) => b.updatedAt - a.updatedAt);
      default:
        return searched;
    }
  },
});

/**
 * Fetch a single profile (ownership enforced).
 */
export const getProfile = query({
  args: { profileId: v.optional(v.id("ai_profiles")) },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    if (!args.profileId) return null;

    const doc = await ctx.db.get(args.profileId);
    if (!doc) return null;
    if (doc.userId !== user.subject) throw new Error("Not authorized");
    return doc;
  },
});

/**
 * Create a profile for the current user.
 */
export const createProfile = mutation({
  args: {
    name: v.string(),
    systemPrompt: v.string(),
    imageKey: v.optional(v.string()),
  },
  returns: v.id("ai_profiles"),
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const now = Date.now();
    const id = await ctx.db.insert("ai_profiles", {
      userId: user.subject,
      name: args.name,
      systemPrompt: args.systemPrompt,
      imageKey: args.imageKey,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Update a profile (ownership enforced).
 */
export const updateProfile = mutation({
  args: {
    profileId: v.id("ai_profiles"),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    imageKey: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.profileId);
    if (!doc) throw new Error("Profile not found");
    if (doc.userId !== user.subject) throw new Error("Not authorized");

    const updates: {
      name?: string;
      systemPrompt?: string;
      imageKey?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (typeof args.name === "string") updates.name = args.name;
    if (typeof args.systemPrompt === "string") updates.systemPrompt = args.systemPrompt;

    if (args.imageKey !== undefined) {
      if (args.imageKey === null) {
        // Remove image key and delete existing image if present
        if (doc.imageKey) {
          if (!doc.imageKey.startsWith(`${user.subject}/`)) {
            throw new Error("Not authorized to delete this image");
          }
          await r2.deleteObject(ctx, doc.imageKey);
        }
        // Do not set imageKey field (remain undefined) to clear it
        updates.imageKey = undefined;
      } else {
        updates.imageKey = args.imageKey;
      }
    }

    await ctx.db.patch(args.profileId, updates);
    return null;
  },
});

/**
 * Delete a profile and its associated image in R2 (if any).
 */
export const deleteProfile = mutation({
  args: { profileId: v.id("ai_profiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.profileId);
    if (!doc) throw new Error("Profile not found");
    if (doc.userId !== user.subject) throw new Error("Not authorized");

    if (doc.imageKey) {
      // Only allow deletion within user's namespace
      if (!doc.imageKey.startsWith(`${user.subject}/`)) {
        throw new Error("Not authorized to delete this image");
      }
      await r2.deleteObject(ctx, doc.imageKey);
    }

    await ctx.db.delete(args.profileId);
    return null;
  },
});

/**
 * Generate an upload URL for a new AI profile image (R2).
 * Client should PUT the file to the returned url with proper Content-Type,
 * then pass back the "key" to createProfile/updateProfile mutations.
 */
export const generateAiProfileUploadUrl = mutation({
  args: {},
  returns: v.object({ url: v.string(), key: v.string() }),
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const key = `${user.subject}/profiles/${crypto.randomUUID()}`;
    // r2.generateUploadUrl returns { url, key }
    return r2.generateUploadUrl(key);
  },
});
