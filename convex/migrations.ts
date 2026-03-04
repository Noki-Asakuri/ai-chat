// oxlint-disable no-unused-vars
import { Migrations } from "@convex-dev/migrations";

import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";

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
