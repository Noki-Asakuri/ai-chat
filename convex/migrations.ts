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

// export const backfillThreads = migrations.define({
//   table: "threads",
//   migrateOne: async (ctx, thread) => {
//     if (thread.pinned === undefined) await ctx.db.patch(thread._id, { pinned: false });
//   },
// });

// export const runAll = migrations.runner([internal.migrations.backfillThreads]);
