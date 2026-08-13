/// <reference types="vite/client" />

import migrationsTest from "@convex-dev/migrations/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DEFAULT_USER_PREFERENCES } from "./functions/users";
import schema, {
  CURRENT_MESSAGE_GRAPH_VERSION,
  MAX_ASSISTANT_VARIANTS_PER_TURN,
} from "./schema";

const modules = import.meta.glob("./**/*.ts");
const USER_ID = "user_legacy_graph_test";

function setup() {
  const t = convexTest(schema, modules);
  migrationsTest.register(t);
  return t.withIdentity({ subject: USER_ID });
}

async function insertThread(
  t: ReturnType<typeof setup>,
  messageGraphVersion?: number,
): Promise<Id<"threads">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("threads", {
      title: "Legacy thread",
      userId: USER_ID,
      updatedAt: 1,
      pinned: false,
      settled: false,
      messageGraphVersion,
      latestModel: "test/model",
      latestModelParams: {
        effort: "medium",
        webSearch: false,
        profile: null,
      },
      groupId: null,
      status: "complete",
    });
  });
}

async function insertUser(t: ReturnType<typeof setup>): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      userId: USER_ID,
      username: null,
      emailAddress: null,
      imageUrl: null,
      preferences: DEFAULT_USER_PREFERENCES,
    });
  });
}

async function insertMessage(
  t: ReturnType<typeof setup>,
  threadId: Id<"threads">,
  role: "user" | "assistant",
  createdAt: number,
  parentUserMessageId?: Id<"messages">,
  variantIndex?: number,
): Promise<Id<"messages">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("messages", {
      threadId,
      userId: USER_ID,
      messageId: crypto.randomUUID(),
      parts: [{ type: "text", text: `${role}-${createdAt}` }],
      status: "complete",
      role,
      attachments: [],
      parentUserMessageId,
      variantIndex,
      createdAt,
      updatedAt: createdAt,
    });
  });
}

async function runMessageGraphMigrations(t: ReturnType<typeof setup>): Promise<void> {
  const migrations = [
    internal.migrations.prepareMessageGraphMigration,
    internal.migrations.backfillMessageGraphParents,
    internal.migrations.normalizeMessageGraphVariantIndexes,
    internal.migrations.repairMessageGraphActiveAssistants,
    internal.migrations.certifyMessageGraphs,
    internal.migrations.markMigratedMessageGraphs,
  ];

  for (const migration of migrations) {
    let cursor: string | null = null;
    do {
      const result: { continueCursor: string; isDone: boolean } = await t.mutation(migration, {
        cursor,
        dryRun: false,
        oneBatchOnly: true,
      });
      cursor = result.isDone ? null : result.continueCursor;
      if (result.isDone) break;
    } while (cursor !== null);
  }
}

describe("message graph migration", () => {
  test("keeps unmarked legacy threads on the complete-history fallback", async () => {
    const t = setup();
    const threadId = await insertThread(t);
    const firstUserId = await insertMessage(t, threadId, "user", 1);
    await insertMessage(t, threadId, "assistant", 2);
    const secondUserId = await insertMessage(t, threadId, "user", 3);
    const secondAssistantId = await insertMessage(t, threadId, "assistant", 4);
    const lateFirstRetryId = await insertMessage(t, threadId, "assistant", 5);

    await t.run(async (ctx) => {
      await ctx.db.patch(firstUserId, { activeAssistantMessageId: lateFirstRetryId });
      await ctx.db.patch(secondUserId, { activeAssistantMessageId: secondAssistantId });
    });

    const page = await t.query(api.functions.messages.getMessagePage, {
      threadId,
      limit: 2,
    });

    expect(page.hasMore).toBe(false);
    expect(page.nextBefore).toBeNull();
    expect(page.messages.map((message) => message._id)).toEqual([
      firstUserId,
      lateFirstRetryId,
      secondUserId,
      secondAssistantId,
    ]);
    expect(page.variantMessageIdsByUserMessageId[firstUserId]).toHaveLength(2);
  });

  test("backfills exact reverse links before chronological fallbacks and marks valid threads", async () => {
    const t = setup();
    const threadId = await insertThread(t);
    const firstUserId = await insertMessage(t, threadId, "user", 1);
    const firstAssistantId = await insertMessage(t, threadId, "assistant", 2);
    const secondUserId = await insertMessage(t, threadId, "user", 3);
    const secondAssistantId = await insertMessage(t, threadId, "assistant", 4);
    const lateFirstRetryId = await insertMessage(t, threadId, "assistant", 5);

    await t.run(async (ctx) => {
      await ctx.db.patch(firstUserId, { activeAssistantMessageId: lateFirstRetryId });
      await ctx.db.patch(secondUserId, { activeAssistantMessageId: secondAssistantId });
    });

    await runMessageGraphMigrations(t);

    const result = await t.run(async (ctx) => ({
      firstAssistant: await ctx.db.get("messages", firstAssistantId),
      secondAssistant: await ctx.db.get("messages", secondAssistantId),
      lateFirstRetry: await ctx.db.get("messages", lateFirstRetryId),
      thread: await ctx.db.get("threads", threadId),
    }));

    expect(result.firstAssistant?.parentUserMessageId).toBe(firstUserId);
    expect(result.secondAssistant?.parentUserMessageId).toBe(secondUserId);
    expect(result.lateFirstRetry?.parentUserMessageId).toBe(firstUserId);
    expect(result.thread?.messageGraphVersion).toBe(CURRENT_MESSAGE_GRAPH_VERSION);
  });

  test("paginates marked threads using explicit parents", async () => {
    const t = setup();
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const firstUserId = await insertMessage(t, threadId, "user", 1);
    await insertMessage(t, threadId, "assistant", 2, firstUserId, 0);
    const secondUserId = await insertMessage(t, threadId, "user", 3);
    const secondAssistantId = await insertMessage(t, threadId, "assistant", 4, secondUserId, 0);

    const page = await t.query(api.functions.messages.getMessagePage, {
      threadId,
      limit: 1,
    });

    expect(page.hasMore).toBe(true);
    expect(page.nextBefore).not.toBeNull();
    expect(page.messages.map((message) => message._id)).toEqual([
      secondUserId,
      secondAssistantId,
    ]);
  });

  test("normalizes invalid public pagination inputs", async () => {
    const t = setup();
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    const assistantMessageId = await insertMessage(t, threadId, "assistant", 2, userMessageId, 0);

    const page = await t.query(api.functions.messages.getMessagePage, {
      threadId,
      before: Number.NaN,
      limit: Number.NaN,
    });

    expect(page.messages.map((message) => message._id)).toEqual([
      userMessageId,
      assistantMessageId,
    ]);
  });

  test("keeps branches with invalid copied parents on the legacy fallback", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    const firstAssistantId = await insertMessage(t, threadId, "assistant", 2, userMessageId, 0);
    const invalidAssistantId = await insertMessage(t, threadId, "assistant", 3, firstAssistantId, 1);

    const branchId = await t.mutation(api.functions.threads.branchThread, {
      threadId,
      assistantMessageId: invalidAssistantId,
    });

    const result = await t.run(async (ctx) => ({
      messages: await ctx.db
        .query("messages")
        .withIndex("by_threadId", (q) => q.eq("threadId", branchId))
        .order("asc")
        .collect(),
      thread: await ctx.db.get("threads", branchId),
    }));
    const copiedInvalidAssistant = result.messages.find(
      (message) => message.role === "assistant" && message.createdAt === 3,
    );

    expect(copiedInvalidAssistant?.parentUserMessageId).toBeUndefined();
    expect(result.thread?.messageGraphVersion).toBeUndefined();
  });

  test("does not mark threads whose assistant parent cannot be recovered", async () => {
    const t = setup();
    const threadId = await insertThread(t);
    const orphanAssistantId = await insertMessage(t, threadId, "assistant", 1);

    await runMessageGraphMigrations(t);

    const result = await t.run(async (ctx) => ({
      assistant: await ctx.db.get("messages", orphanAssistantId),
      thread: await ctx.db.get("threads", threadId),
    }));

    expect(result.assistant?.parentUserMessageId).toBeUndefined();
    expect(result.thread?.messageGraphVersion).toBeUndefined();
  });

  test("clears a conflicting active assistant before certifying the thread", async () => {
    const t = setup();
    const threadId = await insertThread(t);
    const firstUserId = await insertMessage(t, threadId, "user", 1);
    const secondUserId = await insertMessage(t, threadId, "user", 2);
    const assistantId = await insertMessage(t, threadId, "assistant", 3, secondUserId);

    await t.run(async (ctx) => {
      await ctx.db.patch(firstUserId, { activeAssistantMessageId: assistantId });
    });

    await runMessageGraphMigrations(t);

    const result = await t.run(async (ctx) => ({
      firstUser: await ctx.db.get("messages", firstUserId),
      assistant: await ctx.db.get("messages", assistantId),
      thread: await ctx.db.get("threads", threadId),
    }));

    expect(result.firstUser?.activeAssistantMessageId).toBeUndefined();
    expect(result.assistant?.parentUserMessageId).toBe(secondUserId);
    expect(result.assistant?.variantIndex).toBe(0);
    expect(result.thread?.messageGraphVersion).toBe(CURRENT_MESSAGE_GRAPH_VERSION);
  });

  test("normalizes duplicate and missing variant indexes before certification", async () => {
    const t = setup();
    const threadId = await insertThread(t);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    const firstAssistantId = await insertMessage(t, threadId, "assistant", 2, userMessageId, 4);
    const secondAssistantId = await insertMessage(t, threadId, "assistant", 3, userMessageId, 4);
    const thirdAssistantId = await insertMessage(t, threadId, "assistant", 4, userMessageId);

    await runMessageGraphMigrations(t);

    const result = await t.run(async (ctx) => ({
      firstAssistant: await ctx.db.get("messages", firstAssistantId),
      secondAssistant: await ctx.db.get("messages", secondAssistantId),
      thirdAssistant: await ctx.db.get("messages", thirdAssistantId),
      thread: await ctx.db.get("threads", threadId),
    }));

    expect(result.firstAssistant?.variantIndex).toBe(0);
    expect(result.secondAssistant?.variantIndex).toBe(1);
    expect(result.thirdAssistant?.variantIndex).toBe(2);
    expect(result.thread?.messageGraphVersion).toBe(CURRENT_MESSAGE_GRAPH_VERSION);
  });

  test("keeps over-limit historical turns on the complete-history fallback", async () => {
    const t = setup();
    const threadId = await insertThread(t);
    const userMessageId = await insertMessage(t, threadId, "user", 1);

    for (let index = 0; index <= MAX_ASSISTANT_VARIANTS_PER_TURN; index += 1) {
      await insertMessage(t, threadId, "assistant", index + 2, userMessageId, index);
    }

    await runMessageGraphMigrations(t);

    const thread = await t.run(async (ctx) => await ctx.db.get("threads", threadId));
    const page = await t.query(api.functions.messages.getMessagePage, { threadId, limit: 2 });

    expect(thread?.messageGraphVersion).toBeUndefined();
    expect(page.hasMore).toBe(false);
    expect(page.variantMessageIdsByUserMessageId[userMessageId]).toHaveLength(
      MAX_ASSISTANT_VARIANTS_PER_TURN + 1,
    );
  });

  test("keeps branches with conflicting active pointers on the legacy fallback", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const firstUserId = await insertMessage(t, threadId, "user", 1);
    const secondUserId = await insertMessage(t, threadId, "user", 2);
    const assistantId = await insertMessage(t, threadId, "assistant", 3, secondUserId, 0);

    await t.run(async (ctx) => {
      await ctx.db.patch(firstUserId, { activeAssistantMessageId: assistantId });
    });

    const branchId = await t.mutation(api.functions.threads.branchThread, {
      threadId,
      assistantMessageId: assistantId,
    });

    const branch = await t.run(async (ctx) => await ctx.db.get("threads", branchId));
    expect(branch?.messageGraphVersion).toBeUndefined();
  });

  test("certifies a branch from an older variant and remaps its active response", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    const olderAssistantId = await insertMessage(t, threadId, "assistant", 2, userMessageId, 0);
    const newerAssistantId = await insertMessage(t, threadId, "assistant", 3, userMessageId, 1);

    await t.run(async (ctx) => {
      await ctx.db.patch(userMessageId, { activeAssistantMessageId: newerAssistantId });
    });

    const branchId = await t.mutation(api.functions.threads.branchThread, {
      threadId,
      assistantMessageId: olderAssistantId,
    });

    const result = await t.run(async (ctx) => ({
      messages: await ctx.db
        .query("messages")
        .withIndex("by_threadId", (q) => q.eq("threadId", branchId))
        .order("asc")
        .collect(),
      thread: await ctx.db.get("threads", branchId),
    }));
    const copiedUser = result.messages.find((message) => message.role === "user");
    const copiedAssistant = result.messages.find((message) => message.role === "assistant");

    expect(result.thread?.messageGraphVersion).toBe(CURRENT_MESSAGE_GRAPH_VERSION);
    expect(copiedUser?.activeAssistantMessageId).toBe(copiedAssistant?._id);
    expect(copiedAssistant?.parentUserMessageId).toBe(copiedUser?._id);
  });

  test("preserves quarantine evidence across branches and migration reruns", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    const ambiguousAssistantId = await insertMessage(t, threadId, "assistant", 2);

    await t.run(async (ctx) => {
      const secondUserId = await ctx.db.insert("messages", {
        threadId,
        userId: USER_ID,
        messageId: crypto.randomUUID(),
        parts: [{ type: "text", text: "second user" }],
        status: "complete",
        role: "user",
        attachments: [],
        activeAssistantMessageId: ambiguousAssistantId,
        createdAt: 3,
        updatedAt: 3,
      });
      await ctx.db.patch(userMessageId, { activeAssistantMessageId: ambiguousAssistantId });
      expect(secondUserId).toBeDefined();
    });

    await runMessageGraphMigrations(t);
    await runMessageGraphMigrations(t);

    const branchId = await t.mutation(api.functions.threads.branchThread, {
      threadId,
      assistantMessageId: ambiguousAssistantId,
    });
    await runMessageGraphMigrations(t);

    const result = await t.run(async (ctx) => ({
      branchMessages: await ctx.db
        .query("messages")
        .withIndex("by_threadId", (q) => q.eq("threadId", branchId))
        .collect(),
      branch: await ctx.db.get("threads", branchId),
      sourceAssistant: await ctx.db.get("messages", ambiguousAssistantId),
      sourceThread: await ctx.db.get("threads", threadId),
    }));
    const copiedAmbiguousAssistant = result.branchMessages.find(
      (message) => message.role === "assistant",
    );

    expect(result.sourceAssistant?.messageGraphIssue).toBe("ambiguousParent");
    expect(result.sourceThread?.messageGraphVersion).toBeUndefined();
    expect(copiedAmbiguousAssistant?.messageGraphIssue).toBe("ambiguousParent");
    expect(result.branch?.messageGraphVersion).toBeUndefined();
  });

  test("reindexes remaining variants after deleting one", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    await insertMessage(t, threadId, "assistant", 2, userMessageId, 0);
    const middleAssistantId = await insertMessage(t, threadId, "assistant", 3, userMessageId, 1);
    const lastAssistantId = await insertMessage(t, threadId, "assistant", 4, userMessageId, 2);

    await t.run(async (ctx) => {
      await ctx.db.patch(userMessageId, { activeAssistantMessageId: lastAssistantId });
    });

    await t.mutation(api.functions.messages.deleteMessageAndBelow, {
      threadId,
      messageId: middleAssistantId,
      deleteAttachments: false,
      deleteScope: "assistantVariantOnly",
    });

    const variants = await t.run(async (ctx) =>
      await ctx.db
        .query("messages")
        .withIndex("by_threadId_parentUserMessageId", (q) =>
          q.eq("threadId", threadId).eq("parentUserMessageId", userMessageId),
        )
        .collect(),
    );
    variants.sort((left, right) => (left.variantIndex ?? -1) - (right.variantIndex ?? -1));

    expect(variants.map((variant) => variant.variantIndex)).toEqual([0, 1]);
  });
});
