import { Migrations } from "@convex-dev/migrations";

import { components, internal } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";

import { DEFAULT_THREAD_MODEL, mergeUserPreferences } from "./functions/users";
import {
  CURRENT_MESSAGE_GRAPH_VERSION,
  MAX_ASSISTANT_VARIANTS_PER_TURN,
} from "./schema";

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

function finalizeStreamingParts(parts: Doc<"messages">["parts"]): {
  changed: boolean;
  parts: Doc<"messages">["parts"];
} {
  let changed = false;
  const nextParts: Array<Doc<"messages">["parts"][number]> = [];

  for (const part of parts) {
    if ((part.type === "text" || part.type === "reasoning") && part.state === "streaming") {
      nextParts.push({ ...part, state: "done" });
      changed = true;
      continue;
    }

    nextParts.push(part);
  }

  return { changed, parts: changed ? nextParts : parts };
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

export const finalizeStreamingMessageParts = migrations.define({
  table: "messages",
  migrateOne: async (ctx, message) => {
    if (!Array.isArray(message.parts)) return;

    const { changed, parts } = finalizeStreamingParts(message.parts);
    if (!changed) return;

    await ctx.db.patch(message._id, { parts });
  },
});

export const backfillUserStatsFromMessages = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    await ctx.scheduler.runAfter(0, internal.functions.userStats.migrateUserStatsFromMessages, {
      userId: user.userId,
    });
  },
});

export const prepareMessageGraphMigration = migrations.define({
  table: "threads",
  batchSize: 50,
  migrateOne: async (_ctx, thread) => {
    if (thread.messageGraphVersion === undefined) return;
    return { messageGraphVersion: undefined };
  },
});

export const backfillMessageGraphParents = migrations.define({
  table: "messages",
  batchSize: 50,
  migrateOne: async (ctx, message) => {
    if (message.messageGraphIssue) {
      return { messageGraphVersion: undefined };
    }

    if (message.role === "user") {
      if (message.parentUserMessageId === undefined && message.variantIndex === undefined) {
        if (message.messageGraphVersion === undefined) return;
        return { messageGraphVersion: undefined };
      }
      return {
        parentUserMessageId: undefined,
        variantIndex: undefined,
        messageGraphVersion: undefined,
      };
    }

    if (message.parentUserMessageId) {
      const parent = await ctx.db.get("messages", message.parentUserMessageId);
      if (
        parent?.role === "user" &&
        parent.threadId === message.threadId &&
        parent.userId === message.userId
      ) {
        if (message.messageGraphVersion === undefined) return;
        return { messageGraphVersion: undefined };
      }

      console.warn("Assistant has an invalid explicit parent", {
        messageId: message._id,
        parentUserMessageId: message.parentUserMessageId,
        threadId: message.threadId,
      });
      return {
        parentUserMessageId: undefined,
        messageGraphVersion: undefined,
        messageGraphIssue: "invalidParent" as const,
      };
    }

    const reverseParents = await ctx.db
      .query("messages")
      .withIndex("by_threadId_activeAssistantMessageId", (q) =>
        q.eq("threadId", message.threadId).eq("activeAssistantMessageId", message._id),
      )
      .take(2);

    if (reverseParents.length > 1) {
      console.warn("Ambiguous assistant parent", {
        messageId: message._id,
        threadId: message.threadId,
      });
      return {
        parentUserMessageId: undefined,
        messageGraphVersion: undefined,
        messageGraphIssue: "ambiguousParent" as const,
      };
    }

    const reverseParent = reverseParents[0];
    if (reverseParent) {
      if (reverseParent.role === "user" && reverseParent.userId === message.userId) {
        return {
          parentUserMessageId: reverseParent._id,
          messageGraphVersion: undefined,
        };
      }

      console.warn("Assistant has an invalid reverse parent", {
        messageId: message._id,
        reverseParentId: reverseParent._id,
        threadId: message.threadId,
      });
      return {
        parentUserMessageId: undefined,
        messageGraphVersion: undefined,
        messageGraphIssue: "invalidParent" as const,
      };
    }

    const fallbackParent = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId_role", (q) =>
        q
          .eq("userId", message.userId)
          .eq("threadId", message.threadId)
          .eq("role", "user")
          .lt("_creationTime", message._creationTime),
      )
      .order("desc")
      .first();

    if (!fallbackParent) {
      console.warn("Assistant has no preceding user message", {
        messageId: message._id,
        threadId: message.threadId,
      });
      return {
        parentUserMessageId: undefined,
        messageGraphVersion: undefined,
        messageGraphIssue: "invalidParent" as const,
      };
    }

    return {
      parentUserMessageId: fallbackParent._id,
      messageGraphVersion: undefined,
    };
  },
});

export const normalizeMessageGraphVariantIndexes = migrations.define({
  table: "messages",
  batchSize: 1,
  migrateOne: async (ctx, message) => {
    if (message.role !== "user") return;
    if (message.messageGraphIssue === "variantLimit") {
      return { messageGraphVersion: undefined };
    }

    const variants = await ctx.db
      .query("messages")
      .withIndex("by_threadId_parentUserMessageId", (q) =>
        q.eq("threadId", message.threadId).eq("parentUserMessageId", message._id),
      )
      .take(MAX_ASSISTANT_VARIANTS_PER_TURN + 1);

    if (variants.length > MAX_ASSISTANT_VARIANTS_PER_TURN) {
      console.warn("Assistant variant limit exceeded", {
        messageId: message._id,
        threadId: message.threadId,
      });
      await ctx.db.patch("threads", message.threadId, { messageGraphVersion: undefined });
      return {
        messageGraphVersion: undefined,
        messageGraphIssue: "variantLimit" as const,
      };
    }

    variants.sort((left, right) => {
      const createdAtDelta = left.createdAt - right.createdAt;
      if (createdAtDelta !== 0) return createdAtDelta;

      const creationTimeDelta = left._creationTime - right._creationTime;
      if (creationTimeDelta !== 0) return creationTimeDelta;

      return left.updatedAt - right.updatedAt;
    });

    let changed = false;
    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const variant = variants[variantIndex];
      if (!variant || variant.variantIndex === variantIndex) continue;

      changed = true;
      await ctx.db.patch(variant._id, {
        variantIndex,
        messageGraphVersion: undefined,
      });
    }

    if (!changed) return;

    await ctx.db.patch("threads", message.threadId, { messageGraphVersion: undefined });
    return { messageGraphVersion: undefined };
  },
});

export const repairMessageGraphActiveAssistants = migrations.define({
  table: "messages",
  batchSize: 50,
  migrateOne: async (ctx, message) => {
    if (message.role === "assistant") {
      if (message.activeAssistantMessageId === undefined) return;
      return { activeAssistantMessageId: undefined, messageGraphVersion: undefined };
    }

    if (!message.activeAssistantMessageId) return;

    const activeAssistant = await ctx.db.get("messages", message.activeAssistantMessageId);
    if (
      activeAssistant?.role === "assistant" &&
      activeAssistant.threadId === message.threadId &&
      activeAssistant.userId === message.userId &&
      activeAssistant.parentUserMessageId === message._id
    ) {
      return;
    }

    console.warn("User has an invalid active assistant", {
      activeAssistantMessageId: message.activeAssistantMessageId,
      messageId: message._id,
      threadId: message.threadId,
    });
    return { activeAssistantMessageId: undefined, messageGraphVersion: undefined };
  },
});

export const certifyMessageGraphs = migrations.define({
  table: "messages",
  batchSize: 1,
  migrateOne: async (ctx, message) => {
    if (message.role !== "user") return;
    if (message.parentUserMessageId !== undefined || message.variantIndex !== undefined) return;
    if (message.messageGraphIssue !== undefined) return;

    const thread = await ctx.db.get("threads", message.threadId);
    if (!thread || thread.userId !== message.userId) return;

    const variants = await ctx.db
      .query("messages")
      .withIndex("by_threadId_parentUserMessageId", (q) =>
        q.eq("threadId", message.threadId).eq("parentUserMessageId", message._id),
      )
      .take(MAX_ASSISTANT_VARIANTS_PER_TURN + 1);
    if (variants.length > MAX_ASSISTANT_VARIANTS_PER_TURN) return;

    variants.sort((left, right) => (left.variantIndex ?? -1) - (right.variantIndex ?? -1));
    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const variant = variants[variantIndex];
      if (
        variant?.role !== "assistant" ||
        variant.userId !== message.userId ||
        variant.parentUserMessageId !== message._id ||
        variant.activeAssistantMessageId !== undefined ||
        variant.messageGraphIssue !== undefined ||
        variant.variantIndex !== variantIndex
      ) {
        return;
      }
    }

    if (message.activeAssistantMessageId) {
      const activeAssistant = variants.find(
        (variant) => variant._id === message.activeAssistantMessageId,
      );
      if (!activeAssistant) return;
    }

    for (const variant of variants) {
      await ctx.db.patch(variant._id, {
        messageGraphVersion: CURRENT_MESSAGE_GRAPH_VERSION,
      });
    }
    return { messageGraphVersion: CURRENT_MESSAGE_GRAPH_VERSION };
  },
});

export const markMigratedMessageGraphs = migrations.define({
  table: "threads",
  batchSize: 50,
  migrateOne: async (ctx, thread) => {
    const firstMessage = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
      .first();

    if (!firstMessage) return { messageGraphVersion: CURRENT_MESSAGE_GRAPH_VERSION };

    const uncertifiedMessage = await ctx.db
      .query("messages")
      .withIndex("by_threadId_messageGraphVersion", (q) =>
        q.eq("threadId", thread._id).eq("messageGraphVersion", undefined),
      )
      .first();
    const olderMessage = await ctx.db
      .query("messages")
      .withIndex("by_threadId_messageGraphVersion", (q) =>
        q.eq("threadId", thread._id).lt("messageGraphVersion", CURRENT_MESSAGE_GRAPH_VERSION),
      )
      .first();
    const newerMessage = await ctx.db
      .query("messages")
      .withIndex("by_threadId_messageGraphVersion", (q) =>
        q.eq("threadId", thread._id).gt("messageGraphVersion", CURRENT_MESSAGE_GRAPH_VERSION),
      )
      .first();

    if (uncertifiedMessage || olderMessage || newerMessage) {
      console.warn("Thread message graph remains incomplete", {
        messageId:
          uncertifiedMessage?._id ?? olderMessage?._id ?? newerMessage?._id ?? firstMessage._id,
        threadId: thread._id,
      });
      return;
    }

    return { messageGraphVersion: CURRENT_MESSAGE_GRAPH_VERSION };
  },
});

export const runBackfillThreadModelConfig = migrations.runner([
  internal.migrations.backfillThreadModelConfig,
]);

export const runBackfillUserPreferencesShape = migrations.runner([
  internal.migrations.backfillUserPreferencesShape,
]);

export const runFinalizeStreamingMessageParts = migrations.runner([
  internal.migrations.finalizeStreamingMessageParts,
]);

export const runBackfillUserStatsFromMessages = migrations.runner([
  internal.migrations.backfillUserStatsFromMessages,
]);

export const runBackfillMessageGraphs = migrations.runner([
  internal.migrations.prepareMessageGraphMigration,
  internal.migrations.backfillMessageGraphParents,
  internal.migrations.normalizeMessageGraphVariantIndexes,
  internal.migrations.repairMessageGraphActiveAssistants,
  internal.migrations.certifyMessageGraphs,
  internal.migrations.markMigratedMessageGraphs,
]);
