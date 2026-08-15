/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DEFAULT_USER_PREFERENCES } from "./functions/users";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const USER_ID = "user_auto_settle_test";
const DAY_MS = 24 * 60 * 60 * 1000;

function setup() {
  return convexTest(schema, modules).withIdentity({ subject: USER_ID });
}

async function insertUser(t: ReturnType<typeof setup>, autoSettleDays: number): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      userId: USER_ID,
      username: null,
      emailAddress: null,
      imageUrl: null,
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        threads: { autoSettleDays },
      },
    });
  });
}

async function insertThread(
  t: ReturnType<typeof setup>,
  updatedAt: number,
  status: "pending" | "streaming" | "complete" | "error",
  pinned = false,
): Promise<Id<"threads">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("threads", {
      title: "Auto-settle test thread",
      userId: USER_ID,
      updatedAt,
      pinned,
      settled: false,
      latestModel: "test/model",
      latestModelParams: {
        effort: "medium",
        webSearch: false,
        profile: null,
      },
      groupId: null,
      status,
    });
  });
}

describe("automatic thread settling", () => {
  test("accepts only whole day values from 0 through 90", async () => {
    const t = setup();
    await insertUser(t, 0);

    await t.mutation(api.functions.users.updateUserPreferences, {
      data: { threads: { autoSettleDays: 90 } },
    });

    await expect(
      t.mutation(api.functions.users.updateUserPreferences, {
        data: { threads: { autoSettleDays: -1 } },
      }),
    ).rejects.toThrow("Auto-settle days must be an integer between 0 and 90");
    await expect(
      t.mutation(api.functions.users.updateUserPreferences, {
        data: { threads: { autoSettleDays: 1.5 } },
      }),
    ).rejects.toThrow("Auto-settle days must be an integer between 0 and 90");
    await expect(
      t.mutation(api.functions.users.updateUserPreferences, {
        data: { threads: { autoSettleDays: 91 } },
      }),
    ).rejects.toThrow("Auto-settle days must be an integer between 0 and 90");
  });

  test("settles only inactive completed or failed threads and preserves pinned state", async () => {
    const t = setup();
    await insertUser(t, 3);
    const now = Date.now();
    const oldCompleteId = await insertThread(t, now - 4 * DAY_MS, "complete", true);
    const oldErrorId = await insertThread(t, now - 4 * DAY_MS, "error");
    const oldPendingId = await insertThread(t, now - 4 * DAY_MS, "pending");
    const recentCompleteId = await insertThread(t, now - 2 * DAY_MS, "complete");

    await t.mutation(internal.functions.threads.autoSettleInactiveThreadsForUser, {
      userId: USER_ID,
      cursor: null,
    });

    const threads = await t.run(async (ctx) => {
      return await Promise.all([
        ctx.db.get("threads", oldCompleteId),
        ctx.db.get("threads", oldErrorId),
        ctx.db.get("threads", oldPendingId),
        ctx.db.get("threads", recentCompleteId),
      ]);
    });

    expect(threads[0]).toMatchObject({ pinned: true, settled: true });
    expect(threads[1]).toMatchObject({ settled: true });
    expect(threads[2]).toMatchObject({ settled: false });
    expect(threads[3]).toMatchObject({ settled: false });
  });

  test("does nothing when auto-settle is disabled", async () => {
    const t = setup();
    await insertUser(t, 0);
    const threadId = await insertThread(t, Date.now() - 30 * DAY_MS, "complete");

    await t.mutation(internal.functions.threads.autoSettleInactiveThreadsForUser, {
      userId: USER_ID,
      cursor: null,
    });

    const thread = await t.run(async (ctx) => await ctx.db.get("threads", threadId));
    expect(thread).toMatchObject({ settled: false });
  });
});
