import { describe, expect, test } from "bun:test";

import { flushAutosave } from "./flush-autosave";

describe("flushAutosave", () => {
  test("saves again when values change during a save", async () => {
    let current = { name: "a" };
    const saved: string[] = [];

    await flushAutosave({
      getValues: () => current,
      save: async (values) => {
        saved.push(values.name);
        if (values.name === "a") current = { name: "ab" };
        return values;
      },
    });

    expect(saved).toEqual(["a", "ab"]);
  });

  test("rejects when a save fails", async () => {
    const failing = flushAutosave({
      getValues: () => ({ name: "a" }),
      save: () => Promise.reject(new Error("offline")),
    });

    const error = await failing.then(
      () => null,
      (reason: Error) => reason,
    );
    expect(error?.message).toBe("offline");
  });
});
