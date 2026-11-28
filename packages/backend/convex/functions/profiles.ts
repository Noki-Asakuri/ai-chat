/* oxlint-disable no-await-in-loop -- Convex transaction writes are intentionally sequenced. */
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { authenticatedMutation, authenticatedQuery, r2 } from "../components";
import { mergeUserPreferences } from "./users";

/**
 * A change to where a profile is the default. Only the places named here change, so saving a
 * profile never undoes a default someone else changed while its editor was open.
 */
const defaultChangesValidator = v.object({
  ungrouped: v.optional(v.boolean()),
  addGroupIds: v.array(v.id("groups")),
  removeGroupIds: v.array(v.id("groups")),
});

type DefaultChanges = {
  ungrouped?: boolean;
  addGroupIds: Array<Id<"groups">>;
  removeGroupIds: Array<Id<"groups">>;
};

function listUserGroups(ctx: MutationCtx, userId: string) {
  // Groups are folders a person makes by hand, so every one of them is read.
  return ctx.db
    .query("groups")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

async function setUngroupedDefault(ctx: MutationCtx, user: Doc<"users">, profileId: Id<"profiles"> | null) {
  const current = mergeUserPreferences(user.preferences).models.modelParams.profile ?? null;
  if (current === profileId) return;
  await ctx.db.patch(user._id, {
    preferences: mergeUserPreferences(user.preferences, { models: { modelParams: { profile: profileId } } }),
  });
}

/**
 * Apply `changes` for `profileId`: it takes over the groups it is added to (a group has one
 * default) and gives up the ones it is removed from, if it still holds them.
 */
async function applyDefaultChanges(
  ctx: MutationCtx,
  user: Doc<"users">,
  profileId: Id<"profiles">,
  changes: DefaultChanges,
) {
  const touched = [...changes.addGroupIds, ...changes.removeGroupIds];
  if (touched.length > 0) {
    const groups = await listUserGroups(ctx, user.userId);
    const byId = new Map(groups.map((group) => [group._id, group]));
    for (const groupId of touched) {
      if (byId.has(groupId)) continue;
      // A group deleted since the editor opened is simply skipped; someone else's is refused.
      const group = await ctx.db.get("groups", groupId);
      if (group) throw new Error("Group not found");
    }

    const added = new Set(changes.addGroupIds);
    for (const groupId of added) {
      const group = byId.get(groupId);
      if (group && group.profileId !== profileId) await ctx.db.patch(groupId, { profileId });
    }
    for (const groupId of changes.removeGroupIds) {
      if (!added.has(groupId) && byId.get(groupId)?.profileId === profileId) {
        await ctx.db.patch(groupId, { profileId: undefined });
      }
    }
  }

  if (changes.ungrouped === true) {
    await setUngroupedDefault(ctx, user, profileId);
  } else if (changes.ungrouped === false) {
    const current = mergeUserPreferences(user.preferences).models.modelParams.profile ?? null;
    if (current === profileId) await setUngroupedDefault(ctx, user, null);
  }
}

/**
 * Delete a profile image from storage unless another of the person's profiles still shows it.
 * `exceptProfileId` is the profile giving the image up.
 */
async function deleteImageIfUnused(
  ctx: MutationCtx,
  user: Doc<"users">,
  imageKey: string,
  exceptProfileId?: Id<"profiles">,
) {
  assertOwnImageKey(user, imageKey);
  const profiles = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", user.userId))
    .collect();
  const stillUsed = profiles.some((profile) => profile._id !== exceptProfileId && profile.imageKey === imageKey);
  if (!stillUsed) await r2.deleteObject(ctx, imageKey);
}

/** Remove `profileId` from every group and from Ungrouped, as when it is deleted. */
async function clearProfileDefaults(ctx: MutationCtx, user: Doc<"users">, profileId: Id<"profiles">) {
  const groups = await listUserGroups(ctx, user.userId);
  for (const group of groups) {
    if (group.profileId === profileId) await ctx.db.patch(group._id, { profileId: undefined });
  }
  const current = mergeUserPreferences(user.preferences).models.modelParams.profile ?? null;
  if (current === profileId) await setUngroupedDefault(ctx, user, null);
}

/**
 * Everything the profile picker and the profiles page need: the profiles (most recently updated
 * first), the groups with the profile each one starts new chats with, and the Ungrouped default.
 * Defaults that point at a deleted profile are reported as none.
 */
export const getProfileLibrary = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;

    const [profiles, groups] = await Promise.all([
      ctx.db
        .query("profiles")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", user.userId))
        .order("desc")
        // Profiles and groups are made by hand, one at a time, so a person has every one listed.
        .collect(),
      ctx.db
        .query("groups")
        .withIndex("by_userId", (q) => q.eq("userId", user.userId))
        .order("asc")
        .collect(),
    ]);

    const profileIds = new Set(profiles.map((profile) => profile._id));
    const existing = (profileId: Id<"profiles"> | null | undefined) =>
      profileId && profileIds.has(profileId) ? profileId : null;

    return {
      profiles,
      groups: groups.map((group) => ({
        _id: group._id,
        title: group.title,
        profileId: existing(group.profileId),
      })),
      ungroupedProfileId: existing(mergeUserPreferences(user.preferences).models.modelParams.profile),
    };
  },
});


export const listProfiles = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;

    const docs = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    return docs;
  },
});

/**
 * Fetch a single profile (ownership enforced).
 */
export const getProfile = authenticatedQuery({
  args: { profileId: v.optional(v.id("profiles")) },
  handler: async (ctx, args) => {
    const user = ctx.user;

    if (!args.profileId) return null;

    const doc = await ctx.db.get("profiles", args.profileId);
    if (!doc) return null;
    if (doc.userId !== user.userId) throw new Error("Not authorized");
    return doc;
  },
});

/**
 * Create a profile for the current user.
 */
export const createProfile = authenticatedMutation({
  args: {
    name: v.string(),
    systemPrompt: v.string(),
    imageKey: v.optional(v.string()),
    defaultChanges: v.optional(defaultChangesValidator),
  },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const user = ctx.user;

    const name = args.name.trim();
    const systemPrompt = args.systemPrompt.trim();
    if (!name) throw new Error("Enter a profile name");
    if (!systemPrompt) throw new Error("Enter a system prompt");
    assertOwnImageKey(user, args.imageKey);

    const now = Date.now();
    const id = await ctx.db.insert("profiles", {
      userId: user.userId,
      name,
      systemPrompt,
      imageKey: args.imageKey,
      createdAt: now,
      updatedAt: now,
    });

    if (args.defaultChanges) await applyDefaultChanges(ctx, user, id, args.defaultChanges);
    return id;
  },
});

/**
 * Update a profile (ownership enforced).
 */
export const updateProfile = authenticatedMutation({
  args: {
    profileId: v.id("profiles"),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    imageKey: v.optional(v.nullable(v.string())),
    defaultChanges: v.optional(defaultChangesValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.user;

    const doc = await ctx.db.get("profiles", args.profileId);
    if (!doc) throw new Error("Profile not found");
    if (doc.userId !== user.userId) throw new Error("Not authorized");

    const updates: Partial<Doc<"profiles">> = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Enter a profile name");
      updates.name = name;
    }
    if (args.systemPrompt !== undefined) {
      const systemPrompt = args.systemPrompt.trim();
      if (!systemPrompt) throw new Error("Enter a system prompt");
      updates.systemPrompt = systemPrompt;
    }

    // A new image or none at all both retire the old one, so it doesn't linger in storage.
    if (args.imageKey !== undefined && args.imageKey !== doc.imageKey) {
      assertOwnImageKey(user, args.imageKey ?? undefined);
      if (doc.imageKey) await deleteImageIfUnused(ctx, user, doc.imageKey, doc._id);
      updates.imageKey = args.imageKey ?? undefined;
    }

    await ctx.db.patch(args.profileId, updates);
    if (args.defaultChanges) await applyDefaultChanges(ctx, user, args.profileId, args.defaultChanges);
    return null;
  },
});

/**
 * Delete a profile and its associated image in R2 (if any).
 */
export const deleteProfile = authenticatedMutation({
  args: { profileId: v.id("profiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.user;

    const doc = await ctx.db.get("profiles", args.profileId);
    if (!doc) throw new Error("Profile not found");
    if (doc.userId !== user.userId) throw new Error("Not authorized");

    if (doc.imageKey) await deleteImageIfUnused(ctx, user, doc.imageKey, doc._id);

    // Groups it started new chats in go back to no profile.
    await clearProfileDefaults(ctx, user, args.profileId);
    await ctx.db.delete(args.profileId);
    return null;
  },
});

/**
 * Generate an upload URL for a new AI profile image (R2).
 * Client should PUT the file to the returned url with proper Content-Type,
 * then pass back the "key" to createProfile/updateProfile mutations.
 */
export const generateAiProfileUploadUrl = authenticatedMutation({
  args: {},
  returns: v.object({ url: v.string(), key: v.string() }),
  handler: async (ctx) => {
    const user = ctx.user;

    const key = `${user.userId}/profiles/${crypto.randomUUID()}`;
    // r2.generateUploadUrl returns { url, key }
    return r2.generateUploadUrl(key);
  },
});

/** Profile images live under the owner's own prefix; refuse to store or delete anyone else's. */
function assertOwnImageKey(user: Doc<"users">, imageKey: string | undefined) {
  if (imageKey !== undefined && !imageKey.startsWith(`${user.userId}/`)) {
    throw new Error("Not authorized to use this image");
  }
}

/**
 * Delete an uploaded profile image that no profile uses, like one uploaded for a save that then
 * failed. Images a profile still points at are left alone.
 */
export const discardProfileImage = authenticatedMutation({
  args: { imageKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!args.imageKey.startsWith(`${user.userId}/profiles/`)) {
      throw new Error("Not authorized to use this image");
    }

    await deleteImageIfUnused(ctx, user, args.imageKey);
    return null;
  },
});

/** Set the profile new chats in one group (null for Ungrouped) start with, or none. */
export const setGroupDefaultProfile = authenticatedMutation({
  args: {
    groupId: v.nullable(v.id("groups")),
    profileId: v.nullable(v.id("profiles")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.user;

    if (args.profileId !== null) {
      const profile = await ctx.db.get("profiles", args.profileId);
      if (!profile || profile.userId !== user.userId) throw new Error("Profile not found");
    }

    if (args.groupId === null) {
      await ctx.db.patch(user._id, {
        preferences: mergeUserPreferences(user.preferences, {
          models: { modelParams: { profile: args.profileId } },
        }),
      });
      return null;
    }

    const group = await ctx.db.get("groups", args.groupId);
    if (!group || group.userId !== user.userId) throw new Error("Group not found");
    await ctx.db.patch(group._id, { profileId: args.profileId ?? undefined });
    return null;
  },
});
