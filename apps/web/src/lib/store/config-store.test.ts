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

describe("applyServerSnapshot", () => {
  const snapshot = { model: "a", modelParams };

  test("an unchanged snapshot keeps local changes", () => {
    const store = createConfigStore(snapshot);
    store.getState().setConfig({ model: "b" });

    store.getState().applyServerSnapshot(snapshot, { ...snapshot, modelParams: { ...modelParams } });

    expect(store.getState().model).toBe("b");
  });

  test("merges changed model params into the local ones", () => {
    const store = createConfigStore(snapshot);
    store.getState().setModelParams({ effort: "high" });

    store
      .getState()
      .applyServerSnapshot(snapshot, { ...snapshot, modelParams: { ...modelParams, webSearch: true } });

    expect(store.getState().modelParams).toEqual({ effort: "high", webSearch: true, profile: null });
  });
});
