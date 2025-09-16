import { Migrations } from "@convex-dev/migrations";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { r2 } from "./index";

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
 * Backfill attachments.mimeType by fetching from object storage metadata.
 * Falls back to inferring from filename extension and type when metadata is missing.
 */
export const backfillAttachmentsMimeType = migrations.define({
  table: "attachments",
  migrateOne: async (ctx, attachment) => {
    // Skip if already set
    if (typeof attachment.mimeType === "string" && attachment.mimeType.length > 0) {
      return;
    }

    const key = `${attachment.userId}/${attachment.threadId}/${attachment._id}`;

    let mime: string | undefined;
    try {
      const meta = await r2.getMetadata(ctx, key);
      mime = meta?.contentType;
    } catch (_err) {
      // Ignore errors and attempt inference below
    }

    if (!mime) {
      if (attachment.type === "pdf") {
        mime = "application/pdf";
      } else {
        const lower = attachment.name.toLowerCase();
        const map: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".jpe": "image/jpeg",
          ".webp": "image/webp",
          ".gif": "image/gif",
          ".bmp": "image/bmp",
          ".svg": "image/svg+xml",
          ".tif": "image/tiff",
          ".tiff": "image/tiff",
          ".heic": "image/heic",
          ".heif": "image/heif",
        };
        for (const ext in map) {
          if (lower.endsWith(ext)) {
            mime = map[ext];
            break;
          }
        }
        if (!mime && attachment.type === "image") {
          mime = "image/*";
        }
      }
    }

    if (mime && mime !== attachment.mimeType) {
      await ctx.db.patch(attachment._id, { mimeType: mime });
    }
  },
});

export const backfillAttachmentsPath = migrations.define({
  table: "attachments",
  migrateOne: async (ctx, attachment) => {
    if (attachment.path === undefined) {
      await ctx.db.patch(attachment._id, {
        path: `${attachment.userId}/${attachment.threadId}/${attachment._id}`,
      });
    }
  },
});

export const runBackfillAttachmentsSource = migrations.runner(
  internal.migrations.backfillAttachmentsSource,
);
export const runBackfillAttachmentsMimeType = migrations.runner(
  internal.migrations.backfillAttachmentsMimeType,
);
export const runBackfillAttachmentsPath = migrations.runner(
  internal.migrations.backfillAttachmentsPath,
);
export const runBackfillThreads = migrations.runner(internal.migrations.backfillThreads);
export const runBackfillMessages = migrations.runner(internal.migrations.backfillMessages);

/**
 * Run the full backfill series:
 * 1. backfillAttachmentsMimeType
 * 2. backfillAttachmentsSource
 * 3. backfillThreads
 * 4. backfillMessages
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
  internal.migrations.backfillAttachmentsMimeType,
  internal.migrations.backfillAttachmentsSource,
  internal.migrations.backfillThreads,
  internal.migrations.backfillMessages,
]);
