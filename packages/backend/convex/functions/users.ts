import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";

import { authenticatedMutation, authenticatedQuery } from "../components";
import { AISDKModelParams } from "../schema";

const MODEL_PROVIDER_PREFIXES = ["google/", "openai/", "deepseek/"] as const;

export type UserPreferences = Doc<"users">["preferences"];
export type UserPreferencesPatch = Partial<
  Omit<UserPreferences, "models" | "notifications" | "code">
> & {
  notifications?: Partial<UserPreferences["notifications"]>;
  code?: Partial<UserPreferences["code"]>;
  models?: Omit<Partial<UserPreferences["models"]>, "modelParams"> & {
    modelParams?: Partial<UserPreferences["models"]["modelParams"]>;
  };
};

const userPreferencesPatch = v.object({
  name: v.optional(v.string()),
  globalSystemInstruction: v.optional(v.string()),
  backgroundImage: v.optional(v.nullable(v.string())),
  performanceEnabled: v.optional(v.boolean()),
  sendPreference: v.optional(v.union(v.literal("enter"), v.literal("ctrlEnter"))),
  notifications: v.optional(
    v.object({
      sound: v.optional(v.boolean()),
      desktop: v.optional(v.boolean()),
    }),
  ),
  code: v.optional(
    v.object({
      autoWrap: v.optional(v.boolean()),
      showFullCode: v.optional(v.boolean()),
    }),
  ),
  models: v.optional(
    v.object({
      hidden: v.optional(v.array(v.string())),
      favorite: v.optional(v.array(v.string())),
      defaultModel: v.optional(v.string()),
      modelParams: v.optional(AISDKModelParams.partial()),
    }),
  ),
});

export const DEFAULT_THREAD_MODEL = "google/gemini-3-flash";
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  name: "user",
  globalSystemInstruction: "You are a helpful assistant.",
  backgroundImage: null,
  performanceEnabled: false,
  sendPreference: "enter",
  notifications: {
    sound: true,
    desktop: false,
  },
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

export function mergeUserPreferences(
  current: UserPreferencesPatch | undefined,
  updates?: UserPreferencesPatch,
): UserPreferences {
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...current,
    ...updates,
    notifications: {
      ...DEFAULT_USER_PREFERENCES.notifications,
      ...current?.notifications,
      ...updates?.notifications,
    },
    code: {
      ...DEFAULT_USER_PREFERENCES.code,
      ...current?.code,
      ...updates?.code,
    },
    models: {
      ...DEFAULT_USER_PREFERENCES.models,
      ...current?.models,
      ...updates?.models,
      modelParams: {
        ...DEFAULT_USER_PREFERENCES.models.modelParams,
        ...current?.models?.modelParams,
        ...updates?.models?.modelParams,
      },
    },
  };
}

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
  args: { data: userPreferencesPatch },
  handler: async (ctx, { data }) => {
    const user = ctx.user;
    const updates = structuredClone(data);

    if (updates.models?.hidden !== undefined) {
      updates.models.hidden = sanitizeModelIds(updates.models.hidden);
    }

    if (updates.models?.favorite !== undefined) {
      updates.models.favorite = sanitizeModelIds(updates.models.favorite);
    }

    await ctx.db.patch(user._id, {
      preferences: mergeUserPreferences(user.preferences, updates),
    });
  },
});

export const updateCurrentUserImage = authenticatedMutation({
  args: { imageUrl: v.nullable(v.string()) },
  handler: async (ctx, { imageUrl }) => {
    const user = ctx.user;
    await ctx.db.patch(user._id, { imageUrl, updatedAt: Date.now() });
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
    const modelUpdates: UserPreferencesPatch["models"] = {};

    if (data.hidden !== undefined) {
      modelUpdates.hidden = sanitizeModelIds(data.hidden);
    }

    if (data.favorite !== undefined) {
      modelUpdates.favorite = sanitizeModelIds(data.favorite);
    }

    await ctx.db.patch(user._id, {
      preferences: mergeUserPreferences(user.preferences, { models: modelUpdates }),
    });
  },
});

export const updateUserDefaultModelConfig = authenticatedMutation({
  args: {
    defaultModel: v.string(),
    modelParams: AISDKModelParams,
  },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const preferences = mergeUserPreferences(user.preferences);
    const models = preferences.models;

    if (
      models.defaultModel === args.defaultModel &&
      models.modelParams.effort === args.modelParams.effort &&
      models.modelParams.webSearch === args.modelParams.webSearch &&
      models.modelParams.profile === args.modelParams.profile
    ) {
      return;
    }

    await ctx.db.patch(user._id, {
      preferences: mergeUserPreferences(preferences, {
        models: {
          defaultModel: args.defaultModel,
          modelParams: args.modelParams,
        },
      }),
    });
  },
});

export const currentUser = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.user;
  },
});

export const getCurrentUserPreferences = authenticatedQuery({
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = args.threadId ? await ctx.db.get("threads", args.threadId) : null;
    if (thread && thread.userId !== user.userId) throw new Error("Not authorized");

    const preferences = mergeUserPreferences(user.preferences);

    return {
      ...preferences,
      models: {
        ...preferences.models,
        defaultModel: preferences.models.defaultModel,

        selectedModel: thread?.latestModel ?? preferences.models.defaultModel,
        selectedModelParams: thread?.latestModelParams ?? preferences.models.modelParams,
      },
    };
  },
});
