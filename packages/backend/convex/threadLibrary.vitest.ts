/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { backfillThreadMessageCount } from "./migrations";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { DEFAULT_USER_PREFERENCES } from "./functions/users";
import schema from "./schema";
import { triggers } from "./triggers";

const modules = import.meta.glob("./**/*.ts");
const USER_ID = "user_thread_library_test";
const OTHER_USER_ID = "user_thread_library_other";

function setup() {
  return convexTest(schema, modules).withIdentity({ subject: USER_ID });
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

async function insertThread(
  t: ReturnType<typeof setup>,
  overrides: {
    userId?: string;
    status?: "pending" | "streaming" | "complete" | "error";
    settled?: boolean;
    pinned?: boolean;
    groupId?: Id<"groups"> | null;
    messageCount?: number;
  } = {},
): Promise<Id<"threads">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("threads", {
      title: "Library test thread",
      userId: overrides.userId ?? USER_ID,
      updatedAt: Date.now(),
      pinned: overrides.pinned ?? false,
      settled: overrides.settled ?? false,
      latestModel: "test/model",
      latestModelParams: { effort: "medium", webSearch: false, profile: null },
      groupId: overrides.groupId ?? null,
      status: overrides.status ?? "complete",
      messageCount: overrides.messageCount,
    });
  });
}

function insertMessage(ctx: MutationCtx, threadId: Id<"threads">) {
  const now = Date.now();
  return ctx.db.insert("messages", {
    threadId,
    userId: USER_ID,
    messageId: crypto.randomUUID(),
    parts: [],
    status: "complete",
    role: "user",
    attachments: [],
    createdAt: now,
    updatedAt: now,
  });
}

describe("thread message count trigger", () => {
  test("counts inserted and deleted messages on threads that already have a count", async () => {
    const t = setup();
    const threadId = await insertThread(t, { messageCount: 0 });

    const messageId = await t.run(async (rawCtx) => {
      const ctx = triggers.wrapDB(rawCtx);
      await insertMessage(ctx, threadId);
      return await insertMessage(ctx, threadId);
    });
    expect((await t.run((ctx) => ctx.db.get(threadId)))?.messageCount).toBe(2);

    await t.run(async (rawCtx) => {
      await triggers.wrapDB(rawCtx).db.delete(messageId);
    });
    expect((await t.run((ctx) => ctx.db.get(threadId)))?.messageCount).toBe(1);
  });

  test("leaves threads that are not backfilled yet for the migration", async () => {
    const t = setup();
    const threadId = await insertThread(t);

    await t.run(async (rawCtx) => {
      await insertMessage(triggers.wrapDB(rawCtx), threadId);
    });

    expect((await t.run((ctx) => ctx.db.get(threadId)))?.messageCount).toBeUndefined();
  });
});

describe("message counts through the real mutations", () => {
  test("a new thread starts at zero and counts messages added by an authenticated mutation", async () => {
    const t = setup();
    await insertUser(t);

    const threadId = await t.mutation(api.functions.threads.createThread, {
      groupId: null,
      latestModel: "test/model",
      latestModelParams: { effort: "medium", webSearch: false, profile: null },
    });
    expect((await t.run((ctx) => ctx.db.get(threadId)))?.messageCount).toBe(0);

    await t.mutation(api.functions.messages.addMessagesToThread, {
      threadId,
      messages: [
        { messageId: "user-1", role: "user", status: "complete", parts: [{ type: "text", text: "Hi" }], attachments: [] },
        { messageId: "assistant-1", role: "assistant", status: "pending", parts: [], attachments: [] },
      ],
    });
    expect((await t.run((ctx) => ctx.db.get(threadId)))?.messageCount).toBe(2);
  });

  test("deleting a thread removes its messages", async () => {
    const t = setup();
    await insertUser(t);
    const threadId = await insertThread(t, { messageCount: 2 });
    await t.run(async (ctx) => {
      await insertMessage(ctx, threadId);
      await insertMessage(ctx, threadId);
    });

    await t.mutation(api.functions.threads.deleteThread, { threadId, deleteAttachments: false });

    const remaining = await t.run((ctx) =>
      ctx.db
        .query("messages")
        .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
        .collect(),
    );
    expect(remaining).toHaveLength(0);
  });

  test("the backfill counts threads without a count and leaves counted ones alone", async () => {
    const t = setup();
    const legacy = await insertThread(t);
    const counted = await insertThread(t, { messageCount: 7 });
    await t.run(async (ctx) => {
      await insertMessage(ctx, legacy);
      await insertMessage(ctx, legacy);
      await insertMessage(ctx, counted);
    });

    await t.run(async (ctx) => {
      const threads = await Promise.all([legacy, counted].map((id) => ctx.db.get(id)));
      await Promise.all(threads.flatMap((thread) => (thread ? [backfillThreadMessageCount(ctx, thread)] : [])));
    });

    expect((await t.run((ctx) => ctx.db.get(legacy)))?.messageCount).toBe(2);
    expect((await t.run((ctx) => ctx.db.get(counted)))?.messageCount).toBe(7);
  });
});

describe("listThreadLibrary", () => {
  test("drops links to parent threads that were deleted", async () => {
    const t = setup();
    await insertUser(t);
    const parent = await insertThread(t);
    const branch = await t.run(async (ctx) => {
      const id = await ctx.db.insert("threads", {
        title: "Branch",
        userId: USER_ID,
        updatedAt: Date.now(),
        pinned: false,
        settled: false,
        latestModel: "test/model",
        latestModelParams: { effort: "medium", webSearch: false, profile: null },
        groupId: null,
        status: "complete",
        branchedFrom: parent,
      });
      return id;
    });

    let library = await t.query(api.functions.threads.listThreadLibrary, {});
    expect(library.threads.find((row) => row._id === branch)?.branchedFrom).toBe(parent);

    await t.run((ctx) => ctx.db.delete(parent));
    library = await t.query(api.functions.threads.listThreadLibrary, {});
    expect(library.threads.find((row) => row._id === branch)?.branchedFrom).toBeUndefined();
  });


  test("returns only the user's threads with attachment counts, shares and groups", async () => {
    const t = setup();
    await insertUser(t);

    const groupId = await t.run((ctx) => ctx.db.insert("groups", { title: "Work", userId: USER_ID }));
    const threadId = await insertThread(t, { groupId, messageCount: 4 });
    const legacyThreadId = await insertThread(t);
    await insertThread(t, { userId: OTHER_USER_ID });

    await t.run(async (ctx) => {
      for (const name of ["a.png", "b.pdf"]) {
        // oxlint-disable-next-line no-await-in-loop -- Two inserts in a test; order doesn't matter.
        await ctx.db.insert("attachments", {
          id: name,
          name,
          size: 1,
          type: "image",
          source: "user",
          mimeType: "image/png",
          path: name,
          userId: USER_ID,
          threadId,
        });
      }
      await ctx.db.insert("threadShares", {
        threadId,
        ownerUserId: USER_ID,
        shareId: "share",
        visibility: "public",
        mode: "live",
        allowedEmails: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const library = await t.query(api.functions.threads.listThreadLibrary, {});

    expect(library.groups).toEqual([{ _id: groupId, title: "Work" }]);
    expect(library.threads).toHaveLength(2);

    const thread = library.threads.find((row) => row._id === threadId);
    expect(thread).toMatchObject({ groupId, messageCount: 4, attachmentCount: 2, shared: true });

    const legacyThread = library.threads.find((row) => row._id === legacyThreadId);
    expect(legacyThread).toMatchObject({ messageCount: null, attachmentCount: 0, shared: false });
  });
});

describe("updateThreadsInBulk", () => {
  test("settles only finished threads and skips the rest", async () => {
    const t = setup();
    await insertUser(t);

    const complete = await insertThread(t, { pinned: true });
    const streaming = await insertThread(t, { status: "streaming" });
    const alreadySettled = await insertThread(t, { settled: true });
    const foreign = await insertThread(t, { userId: OTHER_USER_ID });

    const result = await t.mutation(api.functions.threads.updateThreadsInBulk, {
      threadIds: [complete, streaming, alreadySettled, foreign],
      action: { type: "settle" },
    });

    expect(result).toEqual({ updated: 1, skipped: 3 });
    expect(await t.run((ctx) => ctx.db.get(complete))).toMatchObject({ settled: true, pinned: false });
    expect(await t.run((ctx) => ctx.db.get(streaming))).toMatchObject({ settled: false });
    expect(await t.run((ctx) => ctx.db.get(foreign))).toMatchObject({ settled: false });
  });

  test("moves threads into a group the user owns and rejects other users' groups", async () => {
    const t = setup();
    await insertUser(t);

    const groupId = await t.run((ctx) => ctx.db.insert("groups", { title: "Mine", userId: USER_ID }));
    const otherGroupId = await t.run((ctx) =>
      ctx.db.insert("groups", { title: "Theirs", userId: OTHER_USER_ID }),
    );
    const threadId = await insertThread(t);

    await expect(
      t.mutation(api.functions.threads.updateThreadsInBulk, {
        threadIds: [threadId],
        action: { type: "move", groupId: otherGroupId },
      }),
    ).rejects.toThrow("Group not found");

    const result = await t.mutation(api.functions.threads.updateThreadsInBulk, {
      threadIds: [threadId],
      action: { type: "move", groupId },
    });

    expect(result).toEqual({ updated: 1, skipped: 0 });
    expect((await t.run((ctx) => ctx.db.get(threadId)))?.groupId).toBe(groupId);
  });

  test("does not pin settled threads", async () => {
    const t = setup();
    await insertUser(t);

    const settled = await insertThread(t, { settled: true });
    const active = await insertThread(t);

    const result = await t.mutation(api.functions.threads.updateThreadsInBulk, {
      threadIds: [settled, active],
      action: { type: "pin", pinned: true },
    });

    expect(result).toEqual({ updated: 1, skipped: 1 });
    expect((await t.run((ctx) => ctx.db.get(active)))?.pinned).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(settled)))?.pinned).toBe(false);
  });
});
