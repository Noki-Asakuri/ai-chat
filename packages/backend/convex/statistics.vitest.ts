/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { DEFAULT_USER_PREFERENCES } from "./functions/users";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const USER_ID = "user_statistics_test";

function setup() {
  return convexTest(schema, modules).withIdentity({ subject: USER_ID });
}

const zeroTotals = {
  threadsCount: 0,
  userMessagesCount: 0,
  assistantMessagesCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  unreportedInputCount: 0,
  unreportedOutputCount: 0,
  legacyResponsesCount: 0,
};

async function seed(
  t: ReturnType<typeof setup>,
  months: Array<{
    month: string;
    assistantMessagesCount: number;
    inputTokens: number;
    modelCounts: Record<string, number>;
    modelTokenCounts?: Record<string, number>;
    profileCounts: Record<string, number>;
  }>,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      userId: USER_ID,
      username: null,
      emailAddress: null,
      imageUrl: null,
      preferences: DEFAULT_USER_PREFERENCES,
    });
    await Promise.all(
      months.map((month) => ctx.db.insert("monthlyStatistics", { userId: USER_ID, ...zeroTotals, ...month })),
    );
  });
}

describe("getStatistics", () => {
  test("returns per-month model and profile breakdowns and the previous year's totals", async () => {
    const t = setup();
    await seed(t, [
      {
        month: "2024-06",
        assistantMessagesCount: 4,
        inputTokens: 400,
        modelCounts: { "openai/a": 4 },
        profileCounts: { none: 4 },
      },
      {
        month: "2025-01",
        assistantMessagesCount: 3,
        inputTokens: 300,
        modelCounts: { "openai/a": 2, "google/b": 1 },
        modelTokenCounts: { "openai/a": 200 },
        profileCounts: { none: 3 },
      },
      {
        month: "2025-03",
        assistantMessagesCount: 1,
        inputTokens: 50,
        modelCounts: { "google/b": 1 },
        modelTokenCounts: { "google/b": 50 },
        profileCounts: { none: 1 },
      },
    ]);

    const stats = await t.query(api.functions.statistics.getStatistics, { year: 2025 });

    expect(stats.activity).toHaveLength(12);
    const january = stats.activity.find((point) => point.period === "2025-01");
    expect(january?.models.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "google/b", count: 1, tokens: 0 },
      { id: "openai/a", count: 2, tokens: 200 },
    ]);
    expect(january?.profiles).toEqual([{ id: "none", count: 3 }]);
    expect(stats.activity.find((point) => point.period === "2025-02")?.models).toEqual([]);
    expect(stats.previousTotals).toMatchObject({ assistantMessagesCount: 4, inputTokens: 400 });
  });

  test("has no previous totals for the earliest year or for all time", async () => {
    const t = setup();
    await seed(t, [
      {
        month: "2024-06",
        assistantMessagesCount: 4,
        inputTokens: 400,
        modelCounts: { "openai/a": 4 },
        modelTokenCounts: { "openai/a": 400 },
        profileCounts: { none: 4 },
      },
      {
        month: "2025-02",
        assistantMessagesCount: 1,
        inputTokens: 10,
        modelCounts: { "openai/a": 1 },
        modelTokenCounts: { "openai/a": 10 },
        profileCounts: { none: 1 },
      },
    ]);

    const earliest = await t.query(api.functions.statistics.getStatistics, { year: 2024 });
    expect(earliest.previousTotals).toBeNull();

    const allTime = await t.query(api.functions.statistics.getStatistics, {});
    expect(allTime.previousTotals).toBeNull();
    expect(allTime.activity.find((point) => point.period === "2024")?.models).toEqual([
      { id: "openai/a", count: 4, tokens: 400 },
    ]);
    expect(allTime.activity.find((point) => point.period === "2025")?.models).toEqual([
      { id: "openai/a", count: 1, tokens: 10 },
    ]);
  });

  describe("in the current year", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test("compares against the same months of the previous year", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2025-03-15T12:00:00Z"));
      const t = setup();
      await seed(t, [
        {
          month: "2024-02",
          assistantMessagesCount: 2,
          inputTokens: 20,
          modelCounts: { "openai/a": 2 },
          profileCounts: { none: 2 },
        },
        {
          month: "2024-06",
          assistantMessagesCount: 5,
          inputTokens: 500,
          modelCounts: { "openai/a": 5 },
          profileCounts: { none: 5 },
        },
        {
          month: "2025-01",
          assistantMessagesCount: 1,
          inputTokens: 10,
          modelCounts: { "openai/a": 1 },
          profileCounts: { none: 1 },
        },
      ]);

      const stats = await t.query(api.functions.statistics.getStatistics, { year: 2025 });

      expect(stats.activity.map((point) => point.period)).toEqual(["2025-01", "2025-02", "2025-03"]);
      expect(stats.previousTotals).toMatchObject({ assistantMessagesCount: 2, inputTokens: 20 });
    });
  });
});
