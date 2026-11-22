import { describe, expect, test } from "bun:test";

import { createConfigStore, createEffortIntent, getServerStateChanges } from "./config-store";

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

  function storeWithLocalEffort(effort: "high" | "low", queued: boolean) {
    const store = createConfigStore(snapshot);
    store.getState().setModelParams({ effort });
    store.getState().setEffortIntent(createEffortIntent("a", effort, queued));
    return store;
  }

  test("merges changed model params into the local ones", () => {
    const store = createConfigStore(snapshot);
    store.getState().setModelParams({ effort: "high" });

    store
      .getState()
      .applyServerSnapshot(snapshot, { ...snapshot, modelParams: { ...modelParams, webSearch: true } });

    expect(store.getState().modelParams).toEqual({ effort: "high", webSearch: true, profile: null });
  });

  test("an older server effort for the same model does not replace an unconfirmed choice", () => {
    const store = storeWithLocalEffort("low", true);

    // The save of an earlier High choice comes back after Low was chosen.
    store
      .getState()
      .applyServerSnapshot(snapshot, { ...snapshot, modelParams: { ...modelParams, effort: "high" } });

    expect(store.getState().modelParams.effort).toBe("low");
    expect(store.getState().effortIntent).not.toBeNull();
  });

  test("a snapshot showing the sent choice confirms it", () => {
    const store = storeWithLocalEffort("high", false);

    store
      .getState()
      .applyServerSnapshot(snapshot, { ...snapshot, modelParams: { ...modelParams, effort: "high" } });

    expect(store.getState().effortIntent).toBeNull();
    expect(store.getState().modelParams.effort).toBe("high");
  });

  test("a choice still waiting for its save stays after a matching snapshot", () => {
    const store = storeWithLocalEffort("high", true);

    store
      .getState()
      .applyServerSnapshot(snapshot, { ...snapshot, modelParams: { ...modelParams, effort: "high" } });

    expect(store.getState().effortIntent?.queued).toBe(true);
  });

  test("a server switch to another model applies its effort and drops the choice", () => {
    const store = storeWithLocalEffort("high", true);

    store.getState().applyServerSnapshot(snapshot, { model: "b", modelParams: { ...modelParams } });

    expect(store.getState()).toMatchObject({
      model: "b",
      modelParams: { effort: "medium" },
      effortIntent: null,
    });
  });

  test("a server echo of a local model switch keeps the local effort", () => {
    const store = createConfigStore(snapshot);
    store.getState().setConfig({ model: "b" });
    store.getState().setModelParams({ effort: "high" });

    store.getState().applyServerSnapshot(snapshot, { model: "b", modelParams: { ...modelParams } });

    expect(store.getState().modelParams.effort).toBe("high");
  });
});
