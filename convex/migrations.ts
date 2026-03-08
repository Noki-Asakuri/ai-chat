// oxlint-disable no-unused-vars
import { Migrations } from "@convex-dev/migrations";

import { components, internal } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";

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

export const backfillMessages = migrations.define({
  table: "messages",
  migrateOne: async (ctx, data) => {
    // const updates = data;
    // const modelParams = data.modelParams;
    // // Remove deprecated fields from old messages schema.
    // if (typeof updates.content !== "undefined") updates.content = undefined;
    // if (typeof updates.reasoning !== "undefined") updates.reasoning = undefined;
    // if (typeof updates.model !== "undefined") updates.model = undefined;
    // if (typeof updates.modelParams !== "undefined") updates.modelParams = undefined;
    // // Update current metadata to newer schema.
    // if (updates.metadata && typeof updates.metadata.model === "string") {
    //   updates.metadata.model = { request: updates.metadata.model, response: null };
    // }
    // if (updates.metadata) {
    //   // @ts-expect-error
    //   updates.metadata.modelParams = {
    //     effort: modelParams?.effort ?? "medium",
    //     webSearch: modelParams?.webSearchEnabled ?? false,
    //     profile: null,
    //   };
    // }
    const updates: {
      parentUserMessageId?: Id<"messages"> | undefined;
      activeAssistantMessageId?: Id<"messages"> | undefined;
      variantIndex?: number | undefined;
    } = {};

    let shouldPatch = false;

    if (typeof data.parentUserMessageId === "undefined") {
      updates.parentUserMessageId = undefined;
      shouldPatch = true;
    }

    if (typeof data.activeAssistantMessageId === "undefined") {
      updates.activeAssistantMessageId = undefined;
      shouldPatch = true;
    }

    if (typeof data.variantIndex === "undefined") {
      updates.variantIndex = undefined;
      shouldPatch = true;
    }

    if (!shouldPatch) return;

    await ctx.db.patch(data._id, updates);
  },
});

export const runBackfillMessages = migrations.runner([internal.migrations.backfillMessages]);

const DEFAULT_THREAD_MODEL = "google/gemini-3-flash";

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

export const runBackfillThreadModelConfig = migrations.runner([
  internal.migrations.backfillThreadModelConfig,
]);
