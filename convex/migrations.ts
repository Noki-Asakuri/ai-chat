// oxlint-disable no-unused-vars
import { Migrations } from "@convex-dev/migrations";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

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

// export const backfillMessages = migrations.define({
//   table: "messages",
//   migrateOne: async (ctx, data) => {
//     if (!data.metadata) return;
//     const updates = structuredClone(data.metadata);

//     if (typeof updates?.aiProfileId === "string") delete updates.aiProfileId;

//     await ctx.db.patch(data._id, { metadata: updates });
//   },
// });

// export const runBackfillMessages = migrations.runner([internal.migrations.backfillMessages]);
// export const runAll = migrations.runner([internal.migrations.backfillMessages]);
