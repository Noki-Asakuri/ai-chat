/// <reference types="vite/client" />

import migrationsTest from "@convex-dev/migrations/test";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";

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

async function insertAttachment(
  t: ReturnType<typeof setup>,
  threadId: Id<"threads">,
  userId = USER_ID,
): Promise<Id<"attachments">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("attachments", {
      id: crypto.randomUUID(),
      name: "retry.txt",
      size: 10,
      type: "pdf",
      source: "user",
      mimeType: "application/pdf",
      path: `${userId}/${threadId}/retry.pdf`,
      userId,
      threadId,
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

  test("rejects retries that would exceed the assistant variant limit", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    let firstAssistantId: Id<"messages"> | undefined;

    for (let index = 0; index < MAX_ASSISTANT_VARIANTS_PER_TURN; index += 1) {
      const assistantId = await insertMessage(
        t,
        threadId,
        "assistant",
        index + 2,
        userMessageId,
        index,
      );
      firstAssistantId ??= assistantId;
    }

    if (!firstAssistantId) throw new Error("Expected an assistant variant");

    await expect(
      t.mutation(api.functions.messages.prepareRetryTurn, {
        threadId,
        userMessageId,
        assistantMessageId: firstAssistantId,
        mode: "createVariant",
        model: "test/model",
        modelParams: {
          effort: "medium",
          webSearch: false,
          profile: null,
        },
      }),
    ).rejects.toThrow("Assistant variant limit reached");
  });

  test("rejects a variant-limit retry before deleting later turns", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const firstUserMessageId = await insertMessage(t, threadId, "user", 1);
    let firstAssistantId: Id<"messages"> | undefined;

    for (let index = 0; index < MAX_ASSISTANT_VARIANTS_PER_TURN; index += 1) {
      const assistantId = await insertMessage(
        t,
        threadId,
        "assistant",
        index + 2,
        firstUserMessageId,
        index,
      );
      firstAssistantId ??= assistantId;
    }

    if (!firstAssistantId) throw new Error("Expected an assistant variant");
    const laterUserMessageId = await insertMessage(t, threadId, "user", 20);
    const laterAssistantMessageId = await insertMessage(
      t,
      threadId,
      "assistant",
      21,
      laterUserMessageId,
      0,
    );

    await expect(
      t.mutation(api.functions.messages.prepareRetryTurn, {
        threadId,
        userMessageId: firstUserMessageId,
        assistantMessageId: firstAssistantId,
        mode: "createVariant",
        model: "test/model",
        modelParams: { effort: "medium", webSearch: false, profile: null },
      }),
    ).rejects.toThrow("Assistant variant limit reached");

    const laterMessages = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get("messages", laterUserMessageId),
        ctx.db.get("messages", laterAssistantMessageId),
      ]),
    );
    expect(laterMessages.every((message) => message !== null)).toBe(true);
  });

  test("prepares a response for a user turn without an assistant", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);

    const result = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId,
      mode: "createVariant",
      model: "test/retry-model",
      modelParams: {
        effort: "high",
        webSearch: true,
        profile: null,
      },
    });
    if (result.status !== "prepared") throw new Error("Expected retry to prepare immediately");

    const state = await t.run(async (ctx) => ({
      assistant: await ctx.db.get("messages", result.assistantMessageId),
      thread: await ctx.db.get("threads", threadId),
      userMessage: await ctx.db.get("messages", userMessageId),
    }));

    expect(state.assistant).toMatchObject({
      parentUserMessageId: userMessageId,
      variantIndex: 0,
      role: "assistant",
      status: "pending",
      metadata: {
        model: { request: "test/retry-model", response: null },
        modelParams: { effort: "high", webSearch: true, profile: null },
      },
    });
    expect(state.userMessage?.activeAssistantMessageId).toBe(result.assistantMessageId);
    expect(state.thread?.status).toBe("pending");
  });

  test("reuses errored and empty cancelled responses", async () => {
    const scenarios = [
      { status: "error" as const, finishReason: "error", parts: [] },
      { status: "complete" as const, finishReason: "aborted", parts: [] },
    ];

    for (const scenario of scenarios) {
      const t = setup();
      await insertUser(t);
      const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
      const userMessageId = await insertMessage(t, threadId, "user", 1);
      const assistantMessageId = await insertMessage(
        t,
        threadId,
        "assistant",
        2,
        userMessageId,
        0,
      );

      await t.run(async (ctx) => {
        await ctx.db.patch(userMessageId, { activeAssistantMessageId: assistantMessageId });
        await ctx.db.patch(assistantMessageId, {
          status: scenario.status,
          parts: scenario.parts,
          error: scenario.status === "error" ? "Failed" : undefined,
          metadata: {
            model: { request: "test/model", response: null },
            finishReason: scenario.finishReason,
            usages: { inputTokens: 1, outputTokens: 1, reasoningTokens: 0 },
            timeToFirstTokenMs: 1,
            durations: { request: 1, reasoning: 0, text: 1 },
            modelParams: { effort: "medium", webSearch: false, profile: null },
          },
        });
      });

      const result = await t.mutation(api.functions.messages.prepareRetryTurn, {
        threadId,
        userMessageId,
        assistantMessageId,
        mode: "createVariant",
        model: "test/model",
        modelParams: { effort: "medium", webSearch: false, profile: null },
      });
      if (result.status !== "prepared") throw new Error("Expected retry to prepare immediately");

      expect(result.assistantMessageId).toBe(assistantMessageId);
    }
  });

  test("preserves a cancelled response with content unless replacement is requested", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    const assistantMessageId = await insertMessage(
      t,
      threadId,
      "assistant",
      2,
      userMessageId,
      0,
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(userMessageId, { activeAssistantMessageId: assistantMessageId });
      await ctx.db.patch(assistantMessageId, {
        metadata: {
          model: { request: "test/model", response: null },
          finishReason: "aborted",
          usages: { inputTokens: 1, outputTokens: 1, reasoningTokens: 0 },
          timeToFirstTokenMs: 1,
          durations: { request: 1, reasoning: 0, text: 1 },
          modelParams: { effort: "medium", webSearch: false, profile: null },
        },
      });
    });

    const result = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId,
      assistantMessageId,
      mode: "createVariant",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });
    if (result.status !== "prepared") throw new Error("Expected retry to prepare immediately");

    expect(result.assistantMessageId).not.toBe(assistantMessageId);
    const preserved = await t.run(async (ctx) => await ctx.db.get("messages", assistantMessageId));
    expect(preserved?.parts).toEqual([{ type: "text", text: "assistant-2" }]);
  });

  test("replaces a cancelled response with content when requested", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    const assistantMessageId = await insertMessage(
      t,
      threadId,
      "assistant",
      2,
      userMessageId,
      0,
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(userMessageId, { activeAssistantMessageId: assistantMessageId });
      await ctx.db.patch(assistantMessageId, {
        metadata: {
          model: { request: "test/model", response: null },
          finishReason: "aborted",
          usages: { inputTokens: 1, outputTokens: 1, reasoningTokens: 0 },
          timeToFirstTokenMs: 1,
          durations: { request: 1, reasoning: 0, text: 1 },
          modelParams: { effort: "medium", webSearch: false, profile: null },
        },
      });
    });

    const result = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId,
      assistantMessageId,
      mode: "replace",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });
    if (result.status !== "prepared") throw new Error("Expected retry to prepare immediately");

    expect(result.assistantMessageId).toBe(assistantMessageId);
    const replaced = await t.run(async (ctx) => await ctx.db.get("messages", assistantMessageId));
    expect(replaced).toMatchObject({ parts: [], status: "pending" });
  });

  test("rejects an assistant from a different user turn", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const firstUserMessageId = await insertMessage(t, threadId, "user", 1);
    const secondUserMessageId = await insertMessage(t, threadId, "user", 2);
    const secondAssistantMessageId = await insertMessage(
      t,
      threadId,
      "assistant",
      3,
      secondUserMessageId,
      0,
    );

    await expect(
      t.mutation(api.functions.messages.prepareRetryTurn, {
        threadId,
        userMessageId: firstUserMessageId,
        assistantMessageId: secondAssistantMessageId,
        mode: "createVariant",
        model: "test/model",
        modelParams: { effort: "medium", webSearch: false, profile: null },
      }),
    ).rejects.toThrow("does not belong to the retried user turn");
  });

  test("rejects foreign and cross-thread attachments during edit retry", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const otherThreadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    const foreignAttachmentId = await insertAttachment(t, threadId, "another-user");
    const crossThreadAttachmentId = await insertAttachment(t, otherThreadId);

    for (const attachmentId of [foreignAttachmentId, crossThreadAttachmentId]) {
      await expect(
        t.mutation(api.functions.messages.prepareRetryTurn, {
          threadId,
          userMessageId,
          mode: "createVariant",
          model: "test/model",
          modelParams: { effort: "medium", webSearch: false, profile: null },
          userMessage: {
            messageId: userMessageId,
            parts: [{ type: "text", text: "edited" }],
            attachments: [attachmentId],
          },
        }),
      ).rejects.toThrow();
    }
  });

  test("reactivates a settled thread when retry preparation completes", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);
    await t.run(async (ctx) => await ctx.db.patch(threadId, { settled: true }));

    const result = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId,
      mode: "createVariant",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });

    expect(result.status).toBe("prepared");
    const thread = await t.run(async (ctx) => await ctx.db.get("threads", threadId));
    expect(thread).toMatchObject({ settled: false, status: "pending" });
  });

  test("serializes retry preparation per thread and releases the lock on cancellation", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);

    const first = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId,
      mode: "createVariant",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });

    await expect(
      t.mutation(api.functions.messages.prepareRetryTurn, {
        threadId,
        userMessageId,
        mode: "createVariant",
        model: "test/model",
        modelParams: { effort: "medium", webSearch: false, profile: null },
      }),
    ).rejects.toThrow("retry is already in progress");

    await t.mutation(api.functions.messages.cancelRetryAttempt, {
      retryAttemptId: first.retryAttemptId,
      reason: "test cancellation",
    });

    const thread = await t.run(async (ctx) => await ctx.db.get("threads", threadId));
    expect(thread?.retryAttemptId).toBeUndefined();
    expect(thread?.status).toBe("complete");
  });

  test("binds retry stream startup to the active attempt", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);

    const retry = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId,
      mode: "createVariant",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });
    if (retry.status !== "prepared") throw new Error("Expected retry to prepare immediately");

    await expect(
      t.mutation(api.functions.messages.markRetryAttemptStreaming, {
        retryAttemptId: retry.retryAttemptId,
        assistantMessageId: userMessageId,
        resumableStreamId: "wrong-stream",
      }),
    ).resolves.toBe(false);

    await expect(
      t.mutation(api.functions.messages.markRetryAttemptStreaming, {
        retryAttemptId: retry.retryAttemptId,
        assistantMessageId: retry.assistantMessageId,
        resumableStreamId: "retry-stream",
      }),
    ).resolves.toBe(true);

    const state = await t.run(async (ctx) => ({
      attempt: await ctx.db.get("retryAttempts", retry.retryAttemptId),
      message: await ctx.db.get("messages", retry.assistantMessageId),
      thread: await ctx.db.get("threads", threadId),
    }));
    expect(state.attempt?.status).toBe("streaming");
    expect(state.message).toMatchObject({
      status: "streaming",
      resumableStreamId: "retry-stream",
    });
    expect(state.thread?.status).toBe("streaming");
  });

  test("does not let a cancelled retry overwrite a later response", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const userMessageId = await insertMessage(t, threadId, "user", 1);

    const first = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId,
      mode: "createVariant",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });
    if (first.status !== "prepared") throw new Error("Expected retry to prepare immediately");
    await t.mutation(api.functions.messages.cancelRetryAttempt, {
      retryAttemptId: first.retryAttemptId,
    });

    const second = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId,
      mode: "createVariant",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });
    if (second.status !== "prepared") throw new Error("Expected retry to prepare immediately");

    await t.mutation(api.functions.messages.updateErrorMessage, {
      messageId: second.assistantMessageId,
      retryAttemptId: first.retryAttemptId,
      error: "stale retry failure",
    });

    const secondMessage = await t.run(async (ctx) =>
      ctx.db.get("messages", second.assistantMessageId),
    );
    expect(secondMessage?.status).toBe("pending");
  });

  test("deletes large descendant histories in bounded retry batches", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, CURRENT_MESSAGE_GRAPH_VERSION);
    const targetUserMessageId = await insertMessage(t, threadId, "user", 1);

    for (let index = 0; index < 10; index += 1) {
      const userMessageId = await insertMessage(t, threadId, "user", index + 2);
      await insertMessage(t, threadId, "assistant", index + 2.5, userMessageId, 0);
    }

    const initial = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId: targetUserMessageId,
      mode: "createVariant",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });

    expect(initial.status).toBe("preparing");
    vi.useFakeTimers();
    try {
      await t.finishAllScheduledFunctions(() => vi.runOnlyPendingTimers());
    } finally {
      vi.useRealTimers();
    }
    const final = await t.query(api.functions.messages.getRetryAttempt, {
      retryAttemptId: initial.retryAttemptId,
    });
    expect(final.status).toBe("prepared");

    const remainingUsers = await t.run(async (ctx) =>
      ctx.db
        .query("messages")
        .withIndex("by_userId_threadId_role", (q) =>
          q.eq("userId", USER_ID).eq("threadId", threadId).eq("role", "user"),
        )
        .collect(),
    );
    expect(remainingUsers.map((message) => message._id)).toEqual([targetUserMessageId]);
  });

  test("uses a bounded fallback to retry legacy message graphs", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t);
    const targetUserMessageId = await insertMessage(t, threadId, "user", 1);
    const targetAssistantMessageId = await insertMessage(t, threadId, "assistant", 2);
    await insertMessage(t, threadId, "user", 3);
    await insertMessage(t, threadId, "assistant", 4);

    const result = await t.mutation(api.functions.messages.prepareRetryTurn, {
      threadId,
      userMessageId: targetUserMessageId,
      assistantMessageId: targetAssistantMessageId,
      mode: "createVariant",
      model: "test/model",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });

    expect(result.status).toBe("prepared");
    const remainingUsers = await t.run(async (ctx) =>
      ctx.db
        .query("messages")
        .withIndex("by_userId_threadId_role", (q) =>
          q.eq("userId", USER_ID).eq("threadId", threadId).eq("role", "user"),
        )
        .collect(),
    );
    expect(remainingUsers.map((message) => message._id)).toEqual([targetUserMessageId]);
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
