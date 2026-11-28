import { describe, expect, test } from "bun:test";

import {
  OTHER_COLOR,
  SERIES_COLORS,
  UNATTRIBUTED_ID,
  getEntities,
  hasMissingTokenReports,
  isTokenUnreported,
  percentChange,
  type Statistics,
} from "./-statistics-data";

const zero = {
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

function stats(activity: Array<Partial<Statistics["activity"][number]> & { period: string }>): Statistics {
  return {
    totals: zero,
    activity: activity.map((point) => ({ ...zero, models: [], profiles: [], ...point })),
    previousTotals: null,
    dailyActivity: [],
    years: [2026],
    aiProfileRank: [{ id: "p1", name: "Coder", value: 0 }],
    historyReady: true,
  };
}

const GEMINI = "google/gemini-2.5-flash-lite";

describe("getEntities", () => {
  test("adds an Unattributed remainder so model tokens add up to each period's total", () => {
    const data = stats([
      {
        period: "2026-01",
        inputTokens: 80,
        outputTokens: 20,
        models: [{ id: GEMINI, count: 1, tokens: 60 }],
      },
      { period: "2026-02", inputTokens: 10, outputTokens: 0, models: [{ id: GEMINI, count: 1, tokens: 10 }] },
    ]);
    const models = getEntities(data, "model", "tokens");
    expect(models?.map((entity) => [entity.id, entity.values])).toEqual([
      [GEMINI, [60, 10]],
      [UNATTRIBUTED_ID, [40, 0]],
    ]);
  });

  test("gives the top five entities fixed colours and never colours Unattributed", () => {
    const models = Array.from({ length: 6 }, (_, index) => ({
      id: `custom/model-${index}`,
      count: 1,
      tokens: 100 - index,
    }));
    const data = stats([{ period: "2026-01", inputTokens: 10_000, models }]);
    const entities = getEntities(data, "model", "tokens") ?? [];
    const unattributed = entities.find((entity) => entity.id === UNATTRIBUTED_ID);
    // Unattributed is the largest entity here but still keeps the neutral colour.
    expect(entities[0]?.id).toBe(UNATTRIBUTED_ID);
    expect(unattributed?.color).toBe(OTHER_COLOR);
    expect(entities.slice(1, 6).map((entity) => entity.color)).toEqual([...SERIES_COLORS]);
    expect(entities[6]?.color).toBe(OTHER_COLOR);
  });

  test("groups models without a known provider under one Unknown provider row", () => {
    const data = stats([
      {
        period: "2026-01",
        models: [
          { id: "unknown", count: 2, tokens: 0 },
          { id: "retired/model", count: 3, tokens: 0 },
          { id: GEMINI, count: 1, tokens: 0 },
        ],
      },
    ]);
    const providers = getEntities(data, "provider", "messages");
    expect(providers?.map((entity) => [entity.name, entity.total])).toEqual([
      ["Unknown provider", 5],
      ["Gemini", 1],
    ]);
  });

  test("has no profile token breakdown, but ranks profiles by responses", () => {
    const data = stats([
      { period: "2026-01", profiles: [{ id: "p1", count: 2 }] },
      { period: "2026-02", profiles: [{ id: "gone", count: 1 }] },
    ]);
    expect(getEntities(data, "profile", "tokens")).toBeNull();
    expect(getEntities(data, "profile", "messages")?.map((entity) => [entity.name, entity.values])).toEqual([
      ["Coder", [2, 0]],
      ["Deleted profile", [0, 1]],
    ]);
  });
});

describe("percentChange", () => {
  test("returns null without a previous value to compare", () => {
    expect(percentChange(5, undefined)).toBeNull();
    expect(percentChange(5, 0)).toBeNull();
  });

  test("returns the relative change", () => {
    expect(percentChange(150, 100)).toBe(0.5);
    expect(percentChange(50, 100)).toBe(-0.5);
  });
});

describe("token reporting", () => {
  test("treats a span as unreported only when no response reported tokens", () => {
    const allMissing = {
      ...zero,
      assistantMessagesCount: 3,
      unreportedInputCount: 3,
      unreportedOutputCount: 3,
    };
    expect(isTokenUnreported(allMissing)).toBe(true);
    expect(isTokenUnreported({ ...allMissing, unreportedOutputCount: 2, outputTokens: 40 })).toBe(false);
    expect(isTokenUnreported(zero)).toBe(false);
  });

  test("flags a span with any missing token report", () => {
    expect(hasMissingTokenReports({ ...zero, unreportedInputCount: 1 })).toBe(true);
    expect(hasMissingTokenReports({ ...zero, legacyResponsesCount: 4 })).toBe(false);
  });
});
