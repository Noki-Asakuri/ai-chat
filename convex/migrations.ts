// oxlint-disable no-unused-vars
import { Migrations } from "@convex-dev/migrations";

import { components, internal } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";

import { DEFAULT_THREAD_MODEL, mergeUserPreferences } from "./functions/users";

/**
 * Initialize migrations component with DataModel for proper typing.
 */
export const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Generic runner you can use to run a single migration by name:
 * Example:
 *   bunx convex run migrations:run '{fn:"migrations:backfillMessages"}'
 */
export const run = migrations.runner();

function getThreadModelConfigFromMessages(messages: Doc<"messages">[]): {
  latestModel: string;
  latestModelParams: NonNullable<Doc<"threads">["latestModelParams"]>;
} | null {
  for (const message of messages) {
    if (message.role !== "assistant") continue;

    const latestModel = message.metadata?.model.request?.trim();
    if (!latestModel) continue;

    const modelParams = message.metadata?.modelParams;
    if (!modelParams) continue;

    return {
      latestModel,
      latestModelParams: {
        effort: modelParams.effort,
        webSearch: modelParams.webSearch,
        profile: modelParams.profile ?? null,
      },
    };
  }

  return null;
}

export const backfillThreadModelConfig = migrations.define({
  table: "threads",
  migrateOne: async (ctx, thread) => {
    if (thread.latestModel && thread.latestModelParams) {
      return;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .collect();

    const configFromMessages = getThreadModelConfigFromMessages(messages);

    if (configFromMessages) {
      await ctx.db.patch(thread._id, configFromMessages);
      return;
    }

    await ctx.db.patch(thread._id, {
      latestModel: DEFAULT_THREAD_MODEL,
      latestModelParams: {
        effort: "medium",
        webSearch: false,
        profile: null,
      },
    });
  },
});

export const backfillUserPreferencesShape = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    await ctx.db.patch(user._id, { preferences: mergeUserPreferences(user.preferences) });
  },
});

export const runBackfillThreadModelConfig = migrations.runner([
  internal.migrations.backfillThreadModelConfig,
]);

export const runBackfillUserPreferencesShape = migrations.runner([
  internal.migrations.backfillUserPreferencesShape,
]);
