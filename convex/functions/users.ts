import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { type QueryCtx } from "../_generated/server";

import { authenticatedMutation, authenticatedQuery } from "../components";
import { userPreferences } from "../schema";

const MODEL_PROVIDER_PREFIXES = ["google/", "openai/", "deepseek/"] as const;

export type UserPreferences = Doc<"users">["preferences"];
export const DEFAULT_THREAD_MODEL = "google/gemini-3-flash";
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  name: "user",
  globalSystemInstruction: "You are a helpful assistant.",
  backgroundImage: null,
  performanceEnabled: false,
  sendPreference: "enter",
  code: {
    autoWrap: false,
    showFullCode: false,
  },
  models: {
    hidden: [],
    favorite: [],

    defaultModel: DEFAULT_THREAD_MODEL,
    modelParams: {
      effort: "medium",
      webSearch: false,
      profile: null,
    },
  },
};

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

export const updateUserPreferences = authenticatedMutation({
  args: {
    data: userPreferences.partial(),
  },
  handler: async (ctx, { data }) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const updates = structuredClone(data);

    if (updates.models?.hidden !== undefined) {
      updates.models.hidden = sanitizeModelIds(updates.models.hidden);
    }

    if (updates.models?.favorite !== undefined) {
      updates.models.favorite = sanitizeModelIds(updates.models.favorite);
    }

    await ctx.db.patch(user._id, { preferences: { ...user.preferences, ...updates } });
  },
});

export const updateUserModelPreferences = authenticatedMutation({
  args: {
    data: v.object({
      hidden: v.optional(v.array(v.string())),
      favorite: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, { data }) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const updates = structuredClone(user.preferences);

    if (data.hidden !== undefined) {
      updates.models.hidden = sanitizeModelIds(data.hidden);
    }

    if (data.favorite !== undefined) {
      updates.models.favorite = sanitizeModelIds(data.favorite);
    }

    await ctx.db.patch(user._id, { preferences: { ...user.preferences, models: updates.models } });
  },
});

export const currentUser = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    if (!user) return null;

    return user;
  },
});

export const getCurrentUserPreferences = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    return user.preferences;
  },
});
