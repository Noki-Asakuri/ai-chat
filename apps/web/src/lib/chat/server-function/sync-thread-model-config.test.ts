import { afterAll, describe, expect, mock, test } from "bun:test";

// The tRPC client reads environment variables when loaded; this module only needs the queue.
await mock.module("@/lib/trpc/client", () => ({ syncThreadModelConfig: async () => {} }));
const { enqueueThreadSave } = await import("./sync-thread-model-config");

afterAll(() => mock.restore());

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("enqueueThreadSave", () => {
  test("runs saves for one thread in order, each after the previous one settles", async () => {
    const order: string[] = [];
    const first = deferred();

    const a = enqueueThreadSave("thread-1", async () => {
      order.push("model:start");
      await first.promise;
      order.push("model:end");
    });
    const b = enqueueThreadSave("thread-1", async () => {
      order.push("effort");
    });

    await Promise.resolve();
    expect(order).toEqual(["model:start"]);

    first.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(["model:start", "model:end", "effort"]);
  });

  test("a failed save does not block the next one", async () => {
    const failed = enqueueThreadSave("thread-2", async () => {
      throw new Error("network");
    });
    const next = enqueueThreadSave("thread-2", async () => "saved");

    let rejected = false;
    await failed.catch(() => {
      rejected = true;
    });
    expect(rejected).toBe(true);
    expect(await next).toBe("saved");
  });

  test("saves for different threads do not wait for each other", async () => {
    const blocked = deferred();
    void enqueueThreadSave("thread-3", () => blocked.promise);

    expect(await enqueueThreadSave("thread-4", async () => "other thread")).toBe("other thread");
    blocked.resolve();
  });
});
