import { DEFAULT_GENERAL_SETTINGS } from "@ai-chat/shared/chat/preferences";
import { v } from "convex/values";
import { AllModelIds, resolveReasoning, tryGetModelData } from "@ai-chat/shared/chat/models";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

import { authenticatedMutation, authenticatedQuery } from "../components";
import { AISDKModelParams, effort } from "../schema";

const MODEL_IDS: ReadonlySet<string> = new Set(AllModelIds);

export type UserPreferences = Doc<"users">["preferences"];
export type UserPreferencesPatch = Partial<
  Omit<UserPreferences, "models" | "notifications" | "code" | "fonts" | "threads" | "confirmations" | "textGeneration">
> & {
  confirmations?: Partial<NonNullable<UserPreferences["confirmations"]>>;
  textGeneration?: Partial<NonNullable<UserPreferences["textGeneration"]>>;
  notifications?: Partial<UserPreferences["notifications"]>;
  code?: Partial<UserPreferences["code"]>;
  fonts?: Partial<UserPreferences["fonts"]>;
  threads?: Partial<NonNullable<UserPreferences["threads"]>>;
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
  fonts: v.optional(
    v.object({
      ui: v.optional(v.string()),
      code: v.optional(v.string()),
      prompt: v.optional(v.string()),
      uiSize: v.optional(v.number()),
      promptSize: v.optional(v.number()),
      codeSize: v.optional(v.number()),
    }),
  ),
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
  confirmations: v.optional(v.object({
    unpin: v.optional(v.boolean()),
    settle: v.optional(v.boolean()),
    delete: v.optional(v.boolean()),
  })),
  textGeneration: v.optional(v.object({
    model: v.optional(v.string()),
    effort: v.optional(effort),
  })),
  threads: v.optional(
    v.object({
      autoSettleDays: v.optional(v.number()),
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

export const DEFAULT_THREAD_MODEL = DEFAULT_GENERAL_SETTINGS.models.defaultModel;
export const DEFAULT_USER_PREFERENCES = {
  name: "user",
  globalSystemInstruction: "You are a helpful assistant.",
  backgroundImage: null,
  performanceEnabled: false,
  sendPreference: "enter",
  fonts: {
    ui: "Space Grotesk",
    code: "JetBrains Mono",
    prompt: "Space Grotesk",
    uiSize: 16,
    promptSize: 15,
    codeSize: 14,
  },
  notifications: {
    sound: true,
    desktop: false,
  },
  code: {
    autoWrap: false,
    showFullCode: false,
  },
  confirmations: DEFAULT_GENERAL_SETTINGS.confirmations,
  textGeneration: DEFAULT_GENERAL_SETTINGS.textGeneration,
  threads: DEFAULT_GENERAL_SETTINGS.threads,
  models: {
    hidden: [],
    favorite: [],

    defaultModel: DEFAULT_THREAD_MODEL,
    modelParams: {
      ...DEFAULT_GENERAL_SETTINGS.models.modelParams,
      profile: null,
    },
  },
} satisfies UserPreferences;

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
    confirmations: {
      ...DEFAULT_USER_PREFERENCES.confirmations,
      ...current?.confirmations,
      ...updates?.confirmations,
    },
    textGeneration: {
      ...DEFAULT_USER_PREFERENCES.textGeneration,
      ...current?.textGeneration,
      ...updates?.textGeneration,
    },
    threads: {
      autoSettleDays:
        updates?.threads?.autoSettleDays ??
        current?.threads?.autoSettleDays ??
        DEFAULT_USER_PREFERENCES.threads?.autoSettleDays ??
        0,
    },
    fonts: {
      ...DEFAULT_USER_PREFERENCES.fonts,
      ...current?.fonts,
      ...updates?.fonts,
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

function sanitizeModelIds(modelIds: string[]) {
  const next: string[] = [];
  const seen = new Set<string>();

  for (const modelId of modelIds) {
    if (!MODEL_IDS.has(modelId)) continue;
    if (seen.has(modelId)) continue;

    seen.add(modelId);
    next.push(modelId);
  }

  return next;
}

export const updateUserPreferences = authenticatedMutation({
  args: { data: userPreferencesPatch },
  returns: v.null(),
  handler: async (ctx, { data }) => {
    const user = ctx.user;
    const updates = structuredClone(data);

    if (updates.models?.hidden !== undefined) {
      updates.models.hidden = sanitizeModelIds(updates.models.hidden);
    }

    if (updates.models?.favorite !== undefined) {
      updates.models.favorite = sanitizeModelIds(updates.models.favorite);
    }

    const nextPreferences = mergeUserPreferences(user.preferences, updates);
    if (updates.models?.defaultModel !== undefined || updates.models?.modelParams?.effort !== undefined) {
      const model = tryGetModelData(nextPreferences.models.defaultModel);
      if (!model || model.deprecation) throw new Error("Choose an available default model");
      if (resolveReasoning(model, nextPreferences.models.modelParams.effort) !== nextPreferences.models.modelParams.effort) {
        throw new Error("Unsupported reasoning effort for the default model");
      }
    }
    if (updates.textGeneration !== undefined) {
      const model = tryGetModelData(nextPreferences.textGeneration?.model);
      if (!model || model.deprecation || model.modalities.output.length !== 1 || model.modalities.output[0] !== "text") {
        throw new Error("Choose an available model that only outputs text");
      }
      if (resolveReasoning(model, nextPreferences.textGeneration?.effort ?? "medium") !== (nextPreferences.textGeneration?.effort ?? "medium")) {
        throw new Error("Unsupported reasoning effort for the text generation model");
      }
    }

    const autoSettleDays = updates.threads?.autoSettleDays;
    if (
      autoSettleDays !== undefined &&
      (!Number.isInteger(autoSettleDays) || autoSettleDays < 0 || autoSettleDays > 90)
    ) {
      throw new Error("Auto-settle days must be an integer between 0 and 90");
    }

    await ctx.db.patch(user._id, {
      preferences: nextPreferences,
    });

    if (
      autoSettleDays !== undefined &&
      autoSettleDays > 0 &&
      autoSettleDays !== user.preferences.threads?.autoSettleDays
    ) {
      await ctx.scheduler.runAfter(0, internal.functions.threads.autoSettleInactiveThreadsForUser, {
        userId: user.userId,
        cursor: null,
      });
    }

    return null;
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

export const currentUser = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.user;
  },
});

export const getChatShell = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return {
      preferences: mergeUserPreferences(ctx.user.preferences),
      viewer: { imageUrl: ctx.user.imageUrl },
    };
  },
});

export const getCurrentUserPreferences = authenticatedQuery({
  args: { threadId: v.optional(v.id("threads")) },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const thread = args.threadId ? await ctx.db.get("threads", args.threadId) : null;
    if (thread && thread.userId !== user.userId) throw new Error("Not authorized");

    const preferences = mergeUserPreferences(user.preferences);

    const selectedModel = thread?.latestModel ?? preferences.models.defaultModel;
    const selectedModelParams = {
      ...(thread?.latestModelParams ?? preferences.models.modelParams),
      profile: thread?.latestModelParams?.profile ?? preferences.models.modelParams.profile ?? null,
    };

    return {
      ...preferences,
      models: {
        ...preferences.models,

        selectedModel,
        selectedModelParams,
        defaultModel: preferences.models.defaultModel,
      },
    };
  },
});
