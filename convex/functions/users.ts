import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";

import { authenticatedMutation, authenticatedQuery } from "../components";
import { AISDKModelParams, userPreferences } from "../schema";

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

export const updateCurrentUserImage = authenticatedMutation({
  args: {
    imageUrl: v.nullable(v.string()),
  },
  handler: async (ctx, { imageUrl }) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    await ctx.db.patch(user._id, {
      imageUrl,
      updatedAt: Date.now(),
    });
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

export const updateUserDefaultModelConfig = authenticatedMutation({
  args: {
    defaultModel: v.string(),
    modelParams: AISDKModelParams,
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const models = user.preferences.models;

    if (
      models.defaultModel === args.defaultModel &&
      models.modelParams.effort === args.modelParams.effort &&
      models.modelParams.webSearch === args.modelParams.webSearch &&
      models.modelParams.profile === args.modelParams.profile
    ) {
      return;
    }

    await ctx.db.patch(user._id, {
      preferences: {
        ...user.preferences,
        models: { ...models, defaultModel: args.defaultModel, modelParams: args.modelParams },
      },
    });
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
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = args.threadId ? await ctx.db.get("threads", args.threadId) : null;
    if (thread && thread.userId !== user.userId) throw new Error("Not authorized");

    console.log("[Convex] getCurrentUserPreferences", {
      threadId: args.threadId,
      thread: thread?._id,
      latestModel: thread?.latestModel,
      latestModelParams: thread?.latestModelParams,
    });

    return {
      ...user.preferences,
      models: {
        ...user.preferences.models,
        defaultModel: user.preferences.models.defaultModel,

        selectedModel: thread?.latestModel ?? user.preferences.models.defaultModel,
        selectedModelParams: thread?.latestModelParams ?? user.preferences.models.modelParams,
      },
    };
  },
});
