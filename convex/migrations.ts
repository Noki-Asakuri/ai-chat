import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { Doc, Id, DataModel } from "./_generated/dataModel";

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
  table: "threads" as const,
  migrateOne: async (ctx, thread: Doc<"threads">) => {
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
  table: "messages" as const,
  migrateOne: async (ctx, m: Doc<"messages">) => {
    const base = {
      userId: m.userId,
      threadId: m.threadId as Id<"threads">,
      content: m.content,
      createdAt: m.createdAt,
    };

    if (m.role === "user") {
      await ctx.runMutation(internal.functions.userStats.incrementOnUserMessage, base);
      return;
    }

    if (m.role === "assistant" && m.status === "complete") {
      await ctx.runMutation(internal.functions.userStats.incrementOnAssistantComplete, {
        ...base,
        modelUniqueId: m.model,
        aiProfileId: m.metadata?.aiProfileId,
      });
    }
  },
});

/**
 * Backfill attachments.source defaulting to "user" where missing.
 */
export const backfillAttachmentsSource = migrations.define({
  table: "attachments" as const,
  migrateOne: async (ctx, a: Doc<"attachments">) => {
    type Source = "assistant" | "user";
    type AttachmentWithSource = Doc<"attachments"> & { source?: Source };
    const att = a as AttachmentWithSource;
    if (att.source === undefined) {
      await ctx.db.patch(att._id, { source: "user" as const });
    }
  },
});

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