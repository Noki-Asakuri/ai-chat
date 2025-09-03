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

/**
 * Backfill thread counts: increments stats.stats.threads per user's thread.
 * This mirrors the live increment added at
 * - messages.addMessagesToThread() when a thread is auto-created
 */
export const backfillThreads = migrations.define({
  table: "threads",
  migrateOne: async (ctx, thread) => {
    await ctx.runMutation(internal.functions.userStats.incrementThreads, {
      userId: thread.userId,
    });
  },
});

/**
 * Backfill message-derived statistics for each user:
 * - User messages: increment user count, words, per-thread, per-day
 * - Assistant completed messages: increment assistant count, words, per-thread, per-day, model counts, AI profile counts
 * System or non-completed assistant messages are ignored to match live behavior.
 */
export const backfillMessages = migrations.define({
  table: "messages",
  migrateOne: async (ctx, message) => {
    const base = {
      userId: message.userId,
      threadId: message.threadId,
      content: message.content,
      createdAt: message.createdAt,
    };

    if (message.role === "user") {
      await ctx.runMutation(internal.functions.userStats.incrementOnUserMessage, base);
      return;
    }

    if (message.role === "assistant" && message.status === "complete") {
      await ctx.runMutation(internal.functions.userStats.incrementOnAssistantComplete, {
        ...base,
        modelUniqueId: message.model,
        aiProfileId: message.metadata?.aiProfileId,
      });
    }
  },
});

/**
 * Backfill attachments.source defaulting to "user" where missing.
 */
export const backfillAttachmentsSource = migrations.define({
  table: "attachments",
  migrateOne: async (ctx, attachment) => {
    if (attachment.source === undefined) {
      await ctx.db.patch(attachment._id, { source: "user" as const });
    }
  },
});

/**
 * Backfill message modelParams to new format.
 */
export const backfillMessageModelParams = migrations.define({
  table: "messages",
  migrateOne: async (ctx, doc) => {
    const effort = doc.modelParams?.effort ?? "medium";
    const webSearchEnabled =
      doc.modelParams?.webSearchEnabled ?? doc.modelParams?.enableWebSearch ?? false;

    await ctx.db.patch(doc._id, { modelParams: { webSearchEnabled, effort } });
  },
});

export const runBackfillAttachmentsSource = migrations.runner(
  internal.migrations.backfillAttachmentsSource,
);
export const runBackfillMessageModelParams = migrations.runner(
  internal.migrations.backfillMessageModelParams,
);
export const runBackfillThreads = migrations.runner(internal.migrations.backfillThreads);
export const runBackfillMessages = migrations.runner(internal.migrations.backfillMessages);

/**
 * Run the full backfill series:
 * 1. backfillAttachmentsSource
 * 2. backfillThreads
 * 3. backfillMessages
 *
 * Examples:
 *   - Dry run locally:
 *     bunx convex run migrations:runAll '{dryRun:true}'
 *
 *   - Run locally (watch status in another terminal):
 *     bunx convex run migrations:runAll
 *     bunx convex run --component migrations lib:getStatus --watch
 *
 *   - Production:
 *     bunx convex deploy --cmd 'bun run build' && bunx convex run convex/migrations.ts:runAll --prod
 */
export const runAll = migrations.runner([
  internal.migrations.backfillAttachmentsSource,
  internal.migrations.backfillThreads,
  internal.migrations.backfillMessages,
]);
