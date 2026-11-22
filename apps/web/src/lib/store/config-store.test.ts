import { describe, expect, test } from "bun:test";

import { createConfigStore, getServerStateChanges } from "./config-store";

const modelParams = { effort: "medium" as const, webSearch: false, profile: null };

describe("getServerStateChanges", () => {
  test("returns null when no server value changed", () => {
    const previous = { model: "a", modelParams, hiddenModels: ["x"] };
    const next = { model: "a", modelParams: { ...modelParams }, hiddenModels: ["x"] };

    expect(getServerStateChanges(previous, next)).toBeNull();
  });

  test("returns only the changed fields and model params", () => {
    const previous = { model: "a", modelParams, hiddenModels: ["x"] };
    const next = { model: "b", modelParams: { ...modelParams, webSearch: true }, hiddenModels: ["x", "y"] };

    expect(getServerStateChanges(previous, next)).toEqual({
      model: "b",
      modelParams: { webSearch: true },
      hiddenModels: ["x", "y"],
    });
  });
});

describe("setServerState", () => {
  test("merges changed model params into the local ones", () => {
    const store = createConfigStore({ model: "a", modelParams });
    store.getState().setModelParams({ effort: "high" });

    store.getState().setServerState({ modelParams: { webSearch: true } });

    expect(store.getState().modelParams).toEqual({ effort: "high", webSearch: true, profile: null });
  });
});
